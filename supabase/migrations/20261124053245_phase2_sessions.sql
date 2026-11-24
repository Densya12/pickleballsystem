-- Phase 2: sessions (create, start, end).
--
-- BR1: a session is draft, live or ended; a club has at most one live session.
--      Enforced by the partial unique index sessions_one_live_per_club.
-- BR2: session settings + a snapshot of the club's GCash at creation.
-- BR4: ending sets status 'ended' + ended_at and closes check-in. Ended is final.
--
-- Clients can only read (staff of the session's club, every column except
-- display_token). All changes go through the security-definer functions below.

-- Internal helpers live in schema `private`, which the Data API does not
-- expose; clients can neither see nor call them.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Join codes: 6 characters, no look-alikes (no 0, O, 1, I, L).
-- ---------------------------------------------------------------------------

create function private.generate_join_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  -- 23 letters + 8 digits = 31 characters.
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_byte integer;
  v_code text := '';
begin
  while char_length(v_code) < 6 loop
    v_bytes := extensions.gen_random_bytes(16);
    for i in 0..15 loop
      v_byte := get_byte(v_bytes, i);
      -- 248 = 31 * 8: dropping bytes >= 248 keeps every character equally likely.
      if v_byte < 248 then
        v_code := v_code || substr(v_alphabet, (v_byte % 31) + 1, 1);
        exit when char_length(v_code) = 6;
      end if;
    end loop;
  end loop;
  return v_code;
end;
$$;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table public.sessions (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs (id) on delete cascade,
  name          text not null,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  status        text not null default 'draft',
  courts_count  integer not null,
  points_to     integer not null,
  rotation      text not null,
  pay_first     boolean not null default false,
  fee           integer not null,
  -- Snapshot of the club's GCash when the session was created (BR2).
  gcash_name    text,
  gcash_number  text,
  join_code     text not null unique default private.generate_join_code(),
  -- For the display screen (D13). Never readable by clients; see grants below.
  display_token text not null unique
                default translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_'),
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  started_at    timestamptz,
  ended_at      timestamptz,

  constraint sessions_name_length check (char_length(name) between 2 and 60),
  constraint sessions_ends_after_starts check (ends_at > starts_at),
  constraint sessions_status_allowed check (status in ('draft', 'live', 'ended')),
  constraint sessions_courts_count_range check (courts_count between 1 and 8),
  constraint sessions_points_to_allowed check (points_to in (11, 15, 21)),
  constraint sessions_rotation_allowed check (rotation in ('all_off', 'winners_stay')),
  constraint sessions_fee_min check (fee >= 0),
  constraint sessions_gcash_name_length check (gcash_name is null or char_length(gcash_name) <= 80),
  constraint sessions_gcash_number_format check (gcash_number is null or gcash_number ~ '^09[0-9]{9}$'),
  constraint sessions_join_code_format check (join_code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$'),
  constraint sessions_display_token_format check (display_token ~ '^[A-Za-z0-9_-]{43}$'),
  -- Timestamps must match the status: draft has neither, live has started_at,
  -- ended has both (ended sessions were always live first).
  constraint sessions_status_timestamps check (
    (status = 'draft' and started_at is null and ended_at is null)
    or (status = 'live' and started_at is not null and ended_at is null)
    or (status = 'ended' and started_at is not null and ended_at is not null)
  )
);

-- BR1: at most one live session per club, enforced by the database. Two
-- concurrent starts for the same club serialize on this index; the second one
-- fails with unique_violation once the first commits.
create unique index sessions_one_live_per_club on public.sessions (club_id) where status = 'live';

create index sessions_club_id_starts_at_idx on public.sessions (club_id, starts_at);

-- ---------------------------------------------------------------------------
-- Trigger: normalize input + allow only draft -> live -> ended
-- ---------------------------------------------------------------------------

create function public.sessions_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := btrim(new.name);

  if tg_op = 'INSERT' and new.status <> 'draft' then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status
     and not ((old.status = 'draft' and new.status = 'live')
              or (old.status = 'live' and new.status = 'ended')) then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger sessions_before_write
  before insert or update on public.sessions
  for each row execute function public.sessions_before_write();

-- ---------------------------------------------------------------------------
-- Privileges: reset Supabase's default ALL grants. Staff read every column
-- except display_token; no client insert, update or delete.
-- ---------------------------------------------------------------------------

revoke all on public.sessions from anon, authenticated;

grant select (
  id, club_id, name, starts_at, ends_at, status, courts_count, points_to, rotation,
  pay_first, fee, gcash_name, gcash_number, join_code, created_by, created_at,
  started_at, ended_at
) on public.sessions to authenticated;

alter table public.sessions enable row level security;

create policy "Staff can read their club's sessions"
  on public.sessions for select to authenticated
  using (public.is_club_staff(club_id));

-- ---------------------------------------------------------------------------
-- Internal helpers (schema private; they run inside the security-definer
-- RPCs below, so they need no definer rights of their own)
-- ---------------------------------------------------------------------------

-- Signed-in, non-anonymous caller. Anonymous sign-in (players, Phase 4) also
-- gets the authenticated role, so it is refused explicitly.
create function private.assert_organizer_account()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'not_organizer_account' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

-- Locks a session the caller may change. Unknown ids and other clubs'
-- sessions get the same error, so ids can't be probed.
create function private.lock_staff_session(p_session_id uuid)
returns public.sessions
language plpgsql
set search_path = ''
as $$
declare
  v_session public.sessions%rowtype;
begin
  select * into v_session from public.sessions s where s.id = p_session_id for update;
  if not found or not public.is_club_staff(v_session.club_id) then
    raise exception 'session_not_found' using errcode = 'P0001';
  end if;
  return v_session;
end;
$$;

-- draft -> live. BR1 is the partial unique index; its violation becomes
-- 'live_session_exists' for the app.
create function private.session_go_live(p_session_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_constraint text;
begin
  update public.sessions set status = 'live', started_at = now() where id = p_session_id;
exception
  when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'sessions_one_live_per_club' then
      raise exception 'live_session_exists' using errcode = 'P0001';
    end if;
    raise;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPCs (security definer; staff of the club only; anonymous refused)
-- ---------------------------------------------------------------------------

-- Creates a draft (or, with p_start, creates and starts it in one transaction,
-- so a refused start leaves no stray draft). Points, rotation and fee default
-- to the club's defaults; GCash is copied from the club.
create function public.create_session(
  p_club_id      uuid,
  p_name         text,
  p_starts_at    timestamptz,
  p_ends_at      timestamptz,
  p_courts_count integer,
  p_points_to    integer default null,
  p_rotation     text default null,
  p_pay_first    boolean default false,
  p_fee          integer default null,
  p_start        boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.assert_organizer_account();
  v_club public.clubs%rowtype;
  v_session_id uuid;
  v_constraint text;
  v_attempt integer := 0;
begin
  if p_club_id is null or not public.is_club_staff(p_club_id) then
    raise exception 'not_staff' using errcode = '42501';
  end if;

  select * into v_club from public.clubs c where c.id = p_club_id;

  -- Join codes come from a ~887M space; retry the rare collision.
  loop
    begin
      insert into public.sessions (
        club_id, name, starts_at, ends_at, courts_count, points_to, rotation,
        pay_first, fee, gcash_name, gcash_number, created_by
      ) values (
        p_club_id, p_name, p_starts_at, p_ends_at, p_courts_count,
        coalesce(p_points_to, v_club.default_points),
        coalesce(p_rotation, v_club.default_rotation),
        coalesce(p_pay_first, false),
        coalesce(p_fee, v_club.default_fee),
        v_club.gcash_name, v_club.gcash_number, v_uid
      )
      returning id into v_session_id;
      exit;
    exception
      when unique_violation then
        get stacked diagnostics v_constraint = constraint_name;
        v_attempt := v_attempt + 1;
        if v_constraint not in ('sessions_join_code_key', 'sessions_display_token_key')
           or v_attempt >= 5 then
          raise;
        end if;
    end;
  end loop;

  if coalesce(p_start, false) then
    perform private.session_go_live(v_session_id);
  end if;

  return v_session_id;
end;
$$;

create function public.start_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.sessions%rowtype;
begin
  perform private.assert_organizer_account();
  v_session := private.lock_staff_session(p_session_id);

  if v_session.status <> 'draft' then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  perform private.session_go_live(p_session_id);
end;
$$;

-- BR4 (Phase 2 part): live -> ended closes check-in. Ended is final.
create function public.end_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.sessions%rowtype;
begin
  perform private.assert_organizer_account();
  v_session := private.lock_staff_session(p_session_id);

  if v_session.status <> 'live' then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  -- TODO(Phase 3, BR3/BR4): free the session's courts and mark every
  -- session_players row as left here, in the same transaction.

  update public.sessions set status = 'ended', ended_at = now() where id = p_session_id;
end;
$$;

-- Only drafts can be deleted; live and ended sessions are kept.
create function public.delete_draft_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.sessions%rowtype;
begin
  perform private.assert_organizer_account();
  v_session := private.lock_staff_session(p_session_id);

  if v_session.status <> 'draft' then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  delete from public.sessions where id = p_session_id;
end;
$$;

-- For Phase 4 check-in: true only while the session with this code is live.
-- Returns a boolean only (no session data). Codes are matched case-insensitively.
create function public.is_checkin_open(p_join_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.sessions s
    where s.join_code = upper(btrim(p_join_code)) and s.status = 'live'
  );
$$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------

revoke execute on function
  private.generate_join_code(),
  private.assert_organizer_account(),
  private.lock_staff_session(uuid),
  private.session_go_live(uuid),
  public.sessions_before_write(),
  public.create_session(uuid, text, timestamptz, timestamptz, integer, integer, text, boolean, integer, boolean),
  public.start_session(uuid),
  public.end_session(uuid),
  public.delete_draft_session(uuid),
  public.is_checkin_open(text)
from public, anon, authenticated;

grant execute on function
  public.create_session(uuid, text, timestamptz, timestamptz, integer, integer, text, boolean, integer, boolean),
  public.start_session(uuid),
  public.end_session(uuid),
  public.delete_draft_session(uuid)
to authenticated;

-- Players check in without an organizer account (Phase 4), possibly before
-- they have any session, so anon may ask "is check-in open?" too.
grant execute on function public.is_checkin_open(text) to anon, authenticated;
