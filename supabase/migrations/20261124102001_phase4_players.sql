-- Phase 4: player check-in (anonymous sign-in) and the player's queue view.
--
-- Players sign in anonymously when they tap "Pumila na". Their session_players
-- row is tied to auth.uid() through user_id, which clients can never read;
-- "which row is me" is answered only by my_player().
--
-- BR17 pause / resume, BR18 leave (re-joining goes to the end), BR19 "not ready":
-- the player flags it, the organizer swaps them out and they go to the FRONT.
--
-- Organizer functions (Phases 1-3) keep refusing anonymous sessions. Player
-- functions act on the caller's own row only. Every change locks the session
-- row first, as in Phase 3.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------

alter table public.session_players
  add column user_id uuid references auth.users (id) on delete set null,
  -- BR19: set by the player ("Hindi pa ako handa"); the organizer sees it.
  add column not_ready_at timestamptz;

-- One active (non-left) row per user per session. Walk-ins have no user_id.
create unique index session_players_one_active_per_user
  on public.session_players (session_id, user_id)
  where user_id is not null and status <> 'left';

create index session_players_user_id_idx on public.session_players (user_id) where user_id is not null;

-- Clients may read not_ready_at. user_id and device_id stay ungranted: Phase 3
-- granted session_players columns one by one, so new columns aren't readable
-- unless granted here.
grant select (not_ready_at) on public.session_players to authenticated;

-- ---------------------------------------------------------------------------
-- Read access for players (RLS; Realtime uses the same policies)
-- ---------------------------------------------------------------------------

-- True when the caller has a non-left row in the session. After the session
-- ends every row is 'left', so players of an ended session keep read access
-- to it; that is how their phone learns the session ended.
create function public.is_session_player(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.session_players p
    join public.sessions s on s.id = p.session_id
    where p.session_id = p_session_id
      and p.user_id = (select auth.uid())
      and (p.status <> 'left' or s.status = 'ended')
  );
$$;

create policy "Players can read their session"
  on public.sessions for select to authenticated
  using (public.is_session_player(id));

create policy "Players can read their session's players"
  on public.session_players for select to authenticated
  using (public.is_session_player(session_id));

create policy "Players can read their session's courts"
  on public.courts for select to authenticated
  using (public.is_session_player(session_id));

create policy "Players can read their session's games"
  on public.games for select to authenticated
  using (public.is_session_player(session_id));

-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------

-- Any signed-in caller, anonymous players included.
create function private.assert_signed_in()
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
  return v_uid;
end;
$$;

-- The caller's own row in a live session: locks the session first, then the row.
-- Another person's row gets the same error as an unknown id.
create function private.lock_own_player(p_player_id uuid)
returns public.session_players
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := private.assert_signed_in();
  v_session_id uuid;
  v_status text;
  v_player public.session_players%rowtype;
begin
  select p.session_id into v_session_id
  from public.session_players p
  where p.id = p_player_id and p.user_id = v_uid;
  if not found then
    raise exception 'player_not_found' using errcode = 'P0001';
  end if;

  select s.status into v_status from public.sessions s where s.id = v_session_id for update;
  if v_status <> 'live' then
    raise exception 'session_not_live' using errcode = 'P0001';
  end if;

  select * into v_player from public.session_players p where p.id = p_player_id for update;
  return v_player;
end;
$$;

-- Re-queued and newly called players start without a "not ready" flag.
create or replace function private.requeue(p_player_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  foreach v_id in array p_player_ids loop
    update public.session_players
    set status = 'queued', not_ready_at = null, queue_pos = nextval('public.session_players_queue_pos_seq')
    where id = v_id;
  end loop;
end;
$$;

create or replace function private.start_game(p_court_id uuid, p_session_id uuid, p_player_ids uuid[])
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_number integer;
  v_game_id uuid;
begin
  select coalesce(max(g.number), 0) + 1 into v_number from public.games g where g.session_id = p_session_id;

  insert into public.games (session_id, court_id, number, player_ids)
  values (p_session_id, p_court_id, v_number, p_player_ids)
  returning id into v_game_id;

  update public.session_players set status = 'playing', not_ready_at = null where id = any (p_player_ids);
  update public.courts set current_game_id = v_game_id where id = p_court_id;
  return v_game_id;
end;
$$;

-- end_session also clears "not ready" flags (otherwise unchanged from Phase 3).
create or replace function public.end_session(p_session_id uuid)
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

  update public.games set ended_at = now() where session_id = p_session_id and ended_at is null;
  update public.courts set current_game_id = null, winner_streak = 0 where session_id = p_session_id;
  update public.session_players set status = 'left', not_ready_at = null
  where session_id = p_session_id and status <> 'left';

  update public.sessions set status = 'ended', ended_at = now() where id = p_session_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Check-in (public)
-- ---------------------------------------------------------------------------

-- What the check-in page shows. Unknown codes: only 'not_found'. Sessions that
-- aren't live: only their status. Live: name, times, courts and how many wait.
create function public.checkin_preview(p_join_code text)
returns table (
  status text,
  name text,
  starts_at timestamptz,
  ends_at timestamptz,
  courts_count integer,
  waiting integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_session public.sessions%rowtype;
begin
  select * into v_session from public.sessions s where s.join_code = upper(btrim(p_join_code));
  if not found then
    return query select 'not_found'::text, null::text, null::timestamptz, null::timestamptz, null::integer, null::integer;
    return;
  end if;

  if v_session.status <> 'live' then
    return query select v_session.status, null::text, null::timestamptz, null::timestamptz, null::integer, null::integer;
    return;
  end if;

  return query
  select v_session.status, v_session.name, v_session.starts_at, v_session.ends_at, v_session.courts_count,
         (select count(*)::integer from public.session_players p
          where p.session_id = v_session.id and p.status in ('queued', 'paused'));
end;
$$;

-- Adds the caller at the end of the queue (live sessions only). Calling again
-- returns the caller's existing row; after leaving, a new row goes to the end (BR18).
create function public.join_session(p_join_code text, p_display_name text, p_level text default 'unsure')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.assert_signed_in();
  v_session_id uuid;
  v_status text;
  v_player_id uuid;
begin
  select s.id into v_session_id from public.sessions s where s.join_code = upper(btrim(p_join_code));
  if not found then
    raise exception 'session_not_found' using errcode = 'P0001';
  end if;

  select s.status into v_status from public.sessions s where s.id = v_session_id for update;
  if v_status <> 'live' then
    raise exception 'checkin_closed' using errcode = 'P0001';
  end if;

  select p.id into v_player_id
  from public.session_players p
  where p.session_id = v_session_id and p.user_id = v_uid and p.status <> 'left';
  if found then
    return v_player_id;
  end if;

  insert into public.session_players (session_id, display_name, level, user_id, is_walk_in)
  values (v_session_id, p_display_name, coalesce(p_level, 'unsure'), v_uid, false)
  returning id into v_player_id;
  return v_player_id;
end;
$$;

-- The caller's own non-left row in a session (no rows when there is none).
create function public.my_player(p_session_id uuid)
returns table (
  id uuid,
  display_name text,
  level text,
  status text,
  queue_pos bigint,
  games_played integer,
  not_ready_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.level, p.status, p.queue_pos, p.games_played, p.not_ready_at
  from public.session_players p
  where p.session_id = p_session_id
    and p.user_id = (select auth.uid())
    and p.status <> 'left';
$$;

-- ---------------------------------------------------------------------------
-- Player actions: the caller's own row only
-- ---------------------------------------------------------------------------

-- BR17: same rule as the organizer's pause: only while queued.
create function public.player_pause(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.session_players%rowtype := private.lock_own_player(p_player_id);
begin
  if v_player.status <> 'queued' then
    raise exception 'invalid_player_status' using errcode = 'P0001';
  end if;
  update public.session_players set status = 'paused' where id = p_player_id;
end;
$$;

-- BR17: back to the same place.
create function public.player_resume(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.session_players%rowtype := private.lock_own_player(p_player_id);
begin
  if v_player.status <> 'paused' then
    raise exception 'invalid_player_status' using errcode = 'P0001';
  end if;
  update public.session_players set status = 'queued' where id = p_player_id;
end;
$$;

-- BR18: leave the queue (not while playing).
create function public.player_leave(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.session_players%rowtype := private.lock_own_player(p_player_id);
begin
  if v_player.status not in ('queued', 'paused') then
    raise exception 'invalid_player_status' using errcode = 'P0001';
  end if;
  update public.session_players set status = 'left', not_ready_at = null where id = p_player_id;
end;
$$;

-- BR19: "Hindi pa ako handa". Only while playing in a running game. Flags the
-- row for the organizer; the game itself doesn't change until they swap.
create function public.player_not_ready(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.session_players%rowtype := private.lock_own_player(p_player_id);
begin
  if v_player.status <> 'playing' or not exists (
    select 1 from public.games g
    where g.session_id = v_player.session_id and g.ended_at is null and p_player_id = any (g.player_ids)
  ) then
    raise exception 'invalid_player_status' using errcode = 'P0001';
  end if;
  update public.session_players set not_ready_at = coalesce(not_ready_at, now()) where id = p_player_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- BR19 (organizer): swap a not-ready player for the first eligible player.
-- The replaced player goes to the FRONT of the queue. Returns the newcomer.
-- ---------------------------------------------------------------------------

create function public.swap_not_ready(p_court_id uuid, p_player_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_court public.courts%rowtype;
  v_player_ids uuid[];
  v_next uuid[];
  v_front bigint;
begin
  perform private.assert_organizer_account();
  v_court := private.lock_live_court(p_court_id);

  select g.player_ids into v_player_ids from public.games g where g.id = v_court.current_game_id;
  if v_court.current_game_id is null or not (p_player_id = any (v_player_ids)) then
    raise exception 'player_not_on_court' using errcode = 'P0001';
  end if;

  v_next := private.next_eligible(v_court.session_id, 1);
  if cardinality(v_next) < 1 then
    raise exception 'not_enough_players' using errcode = 'P0001', detail = '1';
  end if;

  -- Lowest place among everyone waiting (queued or paused), before the newcomer leaves the queue.
  select min(p.queue_pos) into v_front
  from public.session_players p
  where p.session_id = v_court.session_id and p.status in ('queued', 'paused');

  update public.games set player_ids = array_replace(player_ids, p_player_id, v_next[1])
  where id = v_court.current_game_id;
  update public.session_players set status = 'playing', not_ready_at = null where id = v_next[1];
  update public.session_players
  set status = 'queued', not_ready_at = null, queue_pos = v_front - 1
  where id = p_player_id;

  return v_next[1];
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------

revoke execute on function
  private.assert_signed_in(),
  private.lock_own_player(uuid),
  public.is_session_player(uuid),
  public.checkin_preview(text),
  public.join_session(text, text, text),
  public.my_player(uuid),
  public.player_pause(uuid),
  public.player_resume(uuid),
  public.player_leave(uuid),
  public.player_not_ready(uuid),
  public.swap_not_ready(uuid, uuid)
from public, anon, authenticated;

-- The check-in page asks before anyone signs in.
grant execute on function public.checkin_preview(text) to anon, authenticated;

grant execute on function
  public.is_session_player(uuid),
  public.join_session(text, text, text),
  public.my_player(uuid),
  public.player_pause(uuid),
  public.player_resume(uuid),
  public.player_leave(uuid),
  public.player_not_ready(uuid),
  public.swap_not_ready(uuid, uuid)
to authenticated;
