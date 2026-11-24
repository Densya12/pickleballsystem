-- Phase 1: organizers and clubs.
--
-- Tables: clubs, club_staff, club_invites (all with RLS).
-- Clients never insert/delete clubs or change club_staff directly; those go
-- through the security-definer RPCs below. Column-level grants limit what the
-- `authenticated` role may write even where an RLS policy allows the row.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.clubs (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  city             text,
  gcash_name       text,
  gcash_number     text,
  default_fee      integer not null default 150,
  default_points   integer not null default 11,
  default_rotation text not null default 'all_off',
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint clubs_name_length check (char_length(name) between 2 and 60),
  constraint clubs_city_length check (city is null or char_length(city) <= 60),
  constraint clubs_gcash_name_length check (gcash_name is null or char_length(gcash_name) <= 80),
  constraint clubs_gcash_number_format check (gcash_number is null or gcash_number ~ '^09[0-9]{9}$'),
  constraint clubs_default_fee_min check (default_fee >= 0),
  constraint clubs_default_points_allowed check (default_points in (11, 15, 21)),
  constraint clubs_default_rotation_allowed check (default_rotation in ('all_off', 'winners_stay'))
);

comment on column public.clubs.gcash_number is
  'Normalized by trigger: spaces and dashes stripped; must be 11 digits starting with 09.';

create table public.club_staff (
  club_id    uuid not null references public.clubs (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null,
  created_at timestamptz not null default now(),
  primary key (club_id, user_id),
  constraint club_staff_role_allowed check (role in ('owner', 'organizer'))
);

create index club_staff_user_id_idx on public.club_staff (user_id, created_at);

create table public.club_invites (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs (id) on delete cascade,
  -- 32 random bytes, base64url without padding (43 chars).
  token      text not null unique
             default translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_'),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_by    uuid references auth.users (id) on delete set null,
  used_at    timestamptz,
  revoked_at timestamptz
);

create index club_invites_club_id_idx on public.club_invites (club_id);

-- ---------------------------------------------------------------------------
-- Triggers: normalize input + maintain updated_at
-- ---------------------------------------------------------------------------

create function public.clubs_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := btrim(new.name);
  new.city := nullif(btrim(new.city), '');
  new.gcash_name := nullif(btrim(new.gcash_name), '');
  -- Users may type "0917-123 4567"; store "09171234567".
  new.gcash_number := nullif(regexp_replace(new.gcash_number, '[[:space:]-]', '', 'g'), '');

  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;

  return new;
end;
$$;

create trigger clubs_before_write
  before insert or update on public.clubs
  for each row execute function public.clubs_before_write();

-- ---------------------------------------------------------------------------
-- Helper functions (used by RLS policies)
-- ---------------------------------------------------------------------------

create function public.is_club_staff(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.club_staff s
    where s.club_id = p_club_id and s.user_id = (select auth.uid())
  );
$$;

create function public.is_club_owner(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.club_staff s
    where s.club_id = p_club_id and s.user_id = (select auth.uid()) and s.role = 'owner'
  );
$$;

-- ---------------------------------------------------------------------------
-- Privileges: Supabase grants ALL on new tables to anon/authenticated by
-- default. Reset that, then grant only what the app needs.
-- ---------------------------------------------------------------------------

revoke all on public.clubs, public.club_staff, public.club_invites from anon, authenticated;

grant select on public.clubs to authenticated;
grant update (name, city, gcash_name, gcash_number, default_fee, default_points, default_rotation)
  on public.clubs to authenticated;

grant select on public.club_staff to authenticated;

grant select on public.club_invites to authenticated;
grant insert (club_id) on public.club_invites to authenticated;
grant update (revoked_at) on public.club_invites to authenticated;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.clubs enable row level security;
alter table public.club_staff enable row level security;
alter table public.club_invites enable row level security;

-- clubs: staff can read; only owners can update; no client insert/delete.
create policy "Staff can read their clubs"
  on public.clubs for select to authenticated
  using (public.is_club_staff(id));

create policy "Owners can update their clubs"
  on public.clubs for update to authenticated
  using (public.is_club_owner(id))
  with check (public.is_club_owner(id));

-- club_staff: staff of the club can read; changes only via functions.
create policy "Staff can read their club's staff"
  on public.club_staff for select to authenticated
  using (public.is_club_staff(club_id));

-- club_invites: owners only (read, create, revoke).
create policy "Owners can read invites"
  on public.club_invites for select to authenticated
  using (public.is_club_owner(club_id));

create policy "Owners can create invites"
  on public.club_invites for insert to authenticated
  with check (public.is_club_owner(club_id) and created_by = (select auth.uid()));

create policy "Owners can revoke invites"
  on public.club_invites for update to authenticated
  using (public.is_club_owner(club_id))
  with check (public.is_club_owner(club_id));

-- ---------------------------------------------------------------------------
-- RPCs (security definer; callable by authenticated users only)
-- Errors are raised with stable messages the app maps to Taglish copy.
-- ---------------------------------------------------------------------------

-- Creates a club and makes the caller its owner, in one transaction.
create function public.create_club(p_name text, p_city text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_club_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  -- Players will use Supabase anonymous sign-in (Phase 4), which also gets the
  -- authenticated role. Only real organizer accounts may become staff.
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'not_organizer_account' using errcode = '42501';
  end if;

  insert into public.clubs (name, city, created_by)
  values (p_name, p_city, v_uid)
  returning id into v_club_id;

  insert into public.club_staff (club_id, user_id, role)
  values (v_club_id, v_uid, 'owner');

  return v_club_id;
end;
$$;

-- Joins the caller to the invite's club as organizer. Single use.
-- Already-staff callers get the club id back without using up the invite.
create function public.accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.club_invites%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  -- Players will use Supabase anonymous sign-in (Phase 4), which also gets the
  -- authenticated role. Only real organizer accounts may become staff.
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'not_organizer_account' using errcode = '42501';
  end if;

  select * into v_invite
  from public.club_invites
  where token = p_token
  for update;

  if not found then
    raise exception 'invite_invalid' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.club_staff
    where club_id = v_invite.club_id and user_id = v_uid
  ) then
    return v_invite.club_id;
  end if;

  if v_invite.revoked_at is not null then
    raise exception 'invite_revoked' using errcode = 'P0001';
  end if;
  if v_invite.used_at is not null then
    raise exception 'invite_used' using errcode = 'P0001';
  end if;
  if v_invite.expires_at <= now() then
    raise exception 'invite_expired' using errcode = 'P0001';
  end if;

  insert into public.club_staff (club_id, user_id, role)
  values (v_invite.club_id, v_uid, 'organizer');

  update public.club_invites
  set used_by = v_uid, used_at = now()
  where id = v_invite.id;

  return v_invite.club_id;
end;
$$;

-- Owner-only. Refuses to remove the club's last owner.
create function public.remove_staff(p_club_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_owner_count integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if not public.is_club_owner(p_club_id) then
    raise exception 'not_owner' using errcode = '42501';
  end if;

  -- Lock the club's staff rows so two concurrent removals can't both pass the check.
  perform 1 from public.club_staff where club_id = p_club_id for update;

  select role into v_role
  from public.club_staff
  where club_id = p_club_id and user_id = p_user_id;

  if not found then
    raise exception 'staff_not_found' using errcode = 'P0001';
  end if;

  if v_role = 'owner' then
    select count(*) into v_owner_count
    from public.club_staff
    where club_id = p_club_id and role = 'owner';

    if v_owner_count <= 1 then
      raise exception 'last_owner' using errcode = 'P0001';
    end if;
  end if;

  delete from public.club_staff
  where club_id = p_club_id and user_id = p_user_id;
end;
$$;

-- Staff list with display name + email (auth.users is not readable by clients).
create function public.list_club_staff(p_club_id uuid)
returns table (
  user_id uuid,
  role text,
  email text,
  display_name text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_club_staff(p_club_id) then
    raise exception 'not_staff' using errcode = '42501';
  end if;

  return query
  select
    s.user_id,
    s.role,
    u.email::text,
    nullif(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'), '')::text,
    s.created_at
  from public.club_staff s
  join auth.users u on u.id = s.user_id
  where s.club_id = p_club_id
  order by (s.role = 'owner') desc, s.created_at;
end;
$$;

-- What /invite/[token] shows before joining. Knowing the token is the
-- permission to see the club name (the token is the secret).
-- Only a usable invite reveals the club name. Expired, used, revoked or
-- unknown tokens return just a status word (no club data) so the page can say
-- why the link doesn't work.
create function public.invite_preview(p_token text)
returns table (
  status text,
  club_name text,
  already_staff boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_invite public.club_invites%rowtype;
  v_status text;
  v_club_name text;
  v_already boolean;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select * into v_invite from public.club_invites i where i.token = p_token;
  if not found then
    return query select 'invalid'::text, null::text, false;
    return;
  end if;

  -- Qualify columns: status/club_name are also this function's OUT parameters.
  -- Existing staff may see their own club's name even on a spent link.
  v_already := exists (
    select 1 from public.club_staff s
    where s.club_id = v_invite.club_id and s.user_id = auth.uid()
  );

  v_status := case
    when v_already then 'valid'
    when v_invite.revoked_at is not null then 'revoked'
    when v_invite.used_at is not null then 'used'
    when v_invite.expires_at <= now() then 'expired'
    else 'valid'
  end;

  if v_status = 'valid' then
    select c.name into v_club_name from public.clubs c where c.id = v_invite.club_id;
  end if;

  return query select v_status, v_club_name, v_already;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges: functions are executable by PUBLIC by default, and
-- Supabase also grants anon. Only signed-in users may call these.
-- ---------------------------------------------------------------------------

revoke execute on function
  public.is_club_staff(uuid),
  public.is_club_owner(uuid),
  public.create_club(text, text),
  public.accept_invite(text),
  public.remove_staff(uuid, uuid),
  public.list_club_staff(uuid),
  public.invite_preview(text)
from public, anon;

grant execute on function
  public.is_club_staff(uuid),
  public.is_club_owner(uuid),
  public.create_club(text, text),
  public.accept_invite(text),
  public.remove_staff(uuid, uuid),
  public.list_club_staff(uuid),
  public.invite_preview(text)
to authenticated;

revoke execute on function public.clubs_before_write() from public, anon, authenticated;
