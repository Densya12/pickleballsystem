-- Phase 7: club members, and safe resends for walk-ins (NF10 outbox).
--
-- members: the club's regulars (display_name, level, dues_status, notes).
-- Staff of the club only; players never read members.
-- session_players.member_id now references members (on delete set null).
-- add_walk_in takes an optional p_client_id: resending the same walk-in
-- (offline outbox replay) returns the same player instead of a duplicate,
-- and an optional p_member_id to link a regular.

-- ---------------------------------------------------------------------------
-- members
-- ---------------------------------------------------------------------------

create table public.members (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs (id) on delete cascade,
  display_name text not null,
  level        text not null default 'unsure',
  dues_status  text not null default 'none',
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint members_display_name_length check (char_length(display_name) between 2 and 40),
  constraint members_level_allowed check (level in ('beginner', 'intermediate', 'advanced', 'unsure')),
  -- 'none': the club has no dues for this member.
  constraint members_dues_status_allowed check (dues_status in ('paid', 'unpaid', 'none')),
  constraint members_notes_length check (notes is null or char_length(notes) <= 300)
);

create index members_club_name_idx on public.members (club_id, lower(display_name));

-- Same tidy-up as session_players; empty notes become null.
create function public.members_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.display_name := btrim(regexp_replace(new.display_name, '\s+', ' ', 'g'));
  new.notes := nullif(btrim(new.notes), '');
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger members_before_write
  before insert or update on public.members
  for each row execute function public.members_before_write();

revoke all on public.members from anon, authenticated;
grant select on public.members to authenticated;
grant insert (club_id, display_name, level, dues_status, notes) on public.members to authenticated;
grant update (display_name, level, dues_status, notes) on public.members to authenticated;

alter table public.members enable row level security;

-- Like clubs: staff of the club. Owners and organizers both keep the member list.
create policy "Staff can read their club's members"
  on public.members for select to authenticated
  using (public.is_club_staff(club_id));

create policy "Staff can add members to their club"
  on public.members for insert to authenticated
  with check (public.is_club_staff(club_id));

create policy "Staff can edit their club's members"
  on public.members for update to authenticated
  using (public.is_club_staff(club_id))
  with check (public.is_club_staff(club_id));

-- ---------------------------------------------------------------------------
-- session_players: member link and the walk-in client id
-- ---------------------------------------------------------------------------

alter table public.session_players
  add constraint session_players_member_id_fkey
    foreign key (member_id) references public.members (id) on delete set null,
  -- Set by the organizer's phone for add_walk_in; never readable by clients.
  add column client_id uuid;

create index session_players_member_id_idx on public.session_players (member_id) where member_id is not null;
create unique index session_players_session_client_key
  on public.session_players (session_id, client_id) where client_id is not null;

-- ---------------------------------------------------------------------------
-- add_walk_in: + p_client_id (idempotent resend) and p_member_id (a regular)
-- ---------------------------------------------------------------------------

drop function public.add_walk_in(uuid, text, text, text, text);

create function public.add_walk_in(
  p_session_id   uuid,
  p_display_name text,
  p_level        text,
  p_payment      text default null,
  p_reference    text default null,
  p_client_id    uuid default null,
  p_member_id    uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.sessions%rowtype;
  v_player_id uuid;
begin
  perform private.assert_organizer_account();
  v_session := private.lock_live_session(p_session_id);

  -- A resend of a walk-in already added (the session row is locked, so this can't race).
  if p_client_id is not null then
    select p.id into v_player_id
    from public.session_players p
    where p.session_id = p_session_id and p.client_id = p_client_id;
    if found then
      return v_player_id;
    end if;
  end if;

  if p_payment is not null and p_payment not in ('cash_received', 'gcash', 'later') then
    raise exception 'invalid_payment_method' using errcode = 'P0001';
  end if;
  if p_member_id is not null and not exists (
    select 1 from public.members m where m.id = p_member_id and m.club_id = v_session.club_id
  ) then
    raise exception 'member_not_found' using errcode = 'P0001';
  end if;

  insert into public.session_players (session_id, display_name, level, is_walk_in, client_id, member_id)
  values (p_session_id, p_display_name, p_level, true, p_client_id, p_member_id)
  returning id into v_player_id;

  if v_session.fee > 0 and p_payment is not null then
    perform private.apply_payment_choice(v_player_id, p_payment, p_reference);
  end if;
  return v_player_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- "I-save bilang member": create a member from a player, or link an existing one.
-- With no p_member_id and a member of the same name already in the club,
-- raises 'member_exists' (DETAIL: that member's id) unless p_create_new.
-- Live or ended sessions (the summary offers it too).
-- ---------------------------------------------------------------------------

create function public.save_player_as_member(
  p_player_id  uuid,
  p_member_id  uuid default null,
  p_create_new boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.session_players%rowtype;
  v_club_id uuid;
  v_member_id uuid;
begin
  perform private.assert_organizer_account();
  v_player := private.lock_staff_player(p_player_id);
  select s.club_id into v_club_id from public.sessions s where s.id = v_player.session_id;

  if p_member_id is not null then
    select m.id into v_member_id from public.members m where m.id = p_member_id and m.club_id = v_club_id;
    if not found then
      raise exception 'member_not_found' using errcode = 'P0001';
    end if;
  else
    if not coalesce(p_create_new, false) then
      select m.id into v_member_id
      from public.members m
      where m.club_id = v_club_id and lower(m.display_name) = lower(v_player.display_name)
      order by m.created_at, m.id
      limit 1;
      if found then
        raise exception 'member_exists' using errcode = 'P0001', detail = v_member_id::text;
      end if;
    end if;
    insert into public.members (club_id, display_name, level)
    values (v_club_id, v_player.display_name, v_player.level)
    returning id into v_member_id;
  end if;

  update public.session_players set member_id = v_member_id where id = p_player_id;
  return v_member_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------

revoke execute on function
  public.members_before_write(),
  public.add_walk_in(uuid, text, text, text, text, uuid, uuid),
  public.save_player_as_member(uuid, uuid, boolean)
from public, anon, authenticated;

grant execute on function
  public.add_walk_in(uuid, text, text, text, text, uuid, uuid),
  public.save_player_as_member(uuid, uuid, boolean)
to authenticated;
