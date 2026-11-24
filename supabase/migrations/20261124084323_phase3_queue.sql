-- Phase 3: queue engine (session_players, courts, games) and Realtime.
--
-- BR3  courts 1..N are created when a session goes live.
-- BR5  queue order is queue_pos, lowest first.
-- BR6  eligibility lives in ONE place: private.eligible_players.
-- BR7/BR8  call_next takes the first 4 eligible; fewer than 4 changes nothing.
-- BR10/BR11  rotation after a game: all_off or winners_stay (max 2 in a row).
-- BR12 games_played +1 for the 4 players of every finished game.
-- BR17 pause / resume keeps the player's place. BR18 remove = status 'left'.
-- BR20 walk-ins join the end of the queue.
--
-- Games store the 4 called players (player_ids, in call order) and, in
-- winners stay, the 2 winners. There are no fixed teams: under D11 the four
-- players choose partners on court.
--
-- Every change goes through a security-definer function that refuses
-- anonymous sessions, locks the session row first (so all queue changes for
-- one session run one at a time), checks staff, and requires a live session.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create sequence public.session_players_queue_pos_seq as bigint;

create table public.session_players (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.sessions (id) on delete cascade,
  -- Club members arrive in Phase 7; no foreign key until then.
  member_id    uuid,
  display_name text not null,
  level        text not null default 'unsure',
  status       text not null default 'queued',
  queue_pos    bigint not null default nextval('public.session_players_queue_pos_seq'),
  games_played integer not null default 0,
  -- Phase 4 (player phones). Not readable by clients; see grants.
  device_id    text,
  is_walk_in   boolean not null default false,
  created_at   timestamptz not null default now(),

  constraint session_players_display_name_length check (char_length(display_name) between 2 and 40),
  constraint session_players_level_allowed check (level in ('beginner', 'intermediate', 'advanced', 'unsure')),
  constraint session_players_status_allowed check (status in ('queued', 'playing', 'paused', 'left')),
  constraint session_players_games_played_min check (games_played >= 0)
);

alter sequence public.session_players_queue_pos_seq owned by public.session_players.queue_pos;

create index session_players_queue_idx on public.session_players (session_id, status, queue_pos);

create table public.courts (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.sessions (id) on delete cascade,
  number          integer not null,
  label           text not null,
  current_game_id uuid,
  winner_streak   integer not null default 0,

  constraint courts_number_range check (number between 1 and 8),
  constraint courts_winner_streak_min check (winner_streak >= 0),
  constraint courts_session_number_key unique (session_id, number)
);

-- True when the array has no repeated ids.
create function private.uuids_distinct(p_ids uuid[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select count(distinct x) = count(*) from unnest(p_ids) x;
$$;

create table public.games (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions (id) on delete cascade,
  court_id    uuid not null references public.courts (id) on delete cascade,
  number      integer not null,
  -- The 4 called players, in call order (no teams, D11).
  player_ids  uuid[] not null,
  -- winners stay: the 2 winners; otherwise null.
  winner_ids  uuid[],
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,

  constraint games_session_number_key unique (session_id, number),
  constraint games_number_min check (number >= 1),
  constraint games_four_players check (cardinality(player_ids) = 4 and private.uuids_distinct(player_ids)),
  constraint games_two_winners check (
    winner_ids is null
    or (cardinality(winner_ids) = 2 and private.uuids_distinct(winner_ids) and winner_ids <@ player_ids)
  ),
  constraint games_ended_after_started check (ended_at is null or ended_at >= started_at)
);

-- One running game per court.
create unique index games_one_running_per_court on public.games (court_id) where ended_at is null;
create index games_session_id_idx on public.games (session_id);

alter table public.courts
  add constraint courts_current_game_id_fkey
  foreign key (current_game_id) references public.games (id) on delete set null;

-- Normalize names.
create function public.session_players_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.display_name := btrim(regexp_replace(new.display_name, '\s+', ' ', 'g'));
  return new;
end;
$$;

create trigger session_players_before_write
  before insert or update on public.session_players
  for each row execute function public.session_players_before_write();

-- ---------------------------------------------------------------------------
-- Privileges and RLS: staff of the session's club read; no client writes.
-- ---------------------------------------------------------------------------

revoke all on public.session_players, public.courts, public.games from anon, authenticated;
revoke all on sequence public.session_players_queue_pos_seq from anon, authenticated;

grant select (
  id, session_id, member_id, display_name, level, status, queue_pos, games_played, is_walk_in, created_at
) on public.session_players to authenticated;
grant select on public.courts to authenticated;
grant select on public.games to authenticated;

-- Used by RLS policies, so callable by authenticated (returns only a boolean about the caller).
create function public.is_session_staff(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.sessions s
    where s.id = p_session_id and public.is_club_staff(s.club_id)
  );
$$;

alter table public.session_players enable row level security;
alter table public.courts enable row level security;
alter table public.games enable row level security;

create policy "Staff can read their sessions' players"
  on public.session_players for select to authenticated
  using (public.is_session_staff(session_id));

create policy "Staff can read their sessions' courts"
  on public.courts for select to authenticated
  using (public.is_session_staff(session_id));

create policy "Staff can read their sessions' games"
  on public.games for select to authenticated
  using (public.is_session_staff(session_id));

-- ---------------------------------------------------------------------------
-- Eligibility (BR6): the ONE place that decides who can be called.
-- Phase 5 adds the payment condition (sessions.pay_first) here.
-- Paused players are skipped and keep their queue_pos (BR17).
-- ---------------------------------------------------------------------------

create function private.eligible_players(p_session_id uuid)
returns table (player_id uuid, queue_pos bigint)
language sql
stable
set search_path = ''
as $$
  select p.id, p.queue_pos
  from public.session_players p
  where p.session_id = p_session_id
    and p.status = 'queued';
$$;

-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------

-- Locks a live session the caller is staff of (lock first, then everything else).
create function private.lock_live_session(p_session_id uuid)
returns public.sessions
language plpgsql
set search_path = ''
as $$
declare
  v_session public.sessions%rowtype;
begin
  v_session := private.lock_staff_session(p_session_id);
  if v_session.status <> 'live' then
    raise exception 'session_not_live' using errcode = 'P0001';
  end if;
  return v_session;
end;
$$;

-- Court of a live session the caller is staff of. Locks the session, then the court.
create function private.lock_live_court(p_court_id uuid)
returns public.courts
language plpgsql
set search_path = ''
as $$
declare
  v_session_id uuid;
  v_club_id uuid;
  v_court public.courts%rowtype;
begin
  select c.session_id, s.club_id into v_session_id, v_club_id
  from public.courts c join public.sessions s on s.id = c.session_id
  where c.id = p_court_id;
  if not found or not public.is_club_staff(v_club_id) then
    raise exception 'court_not_found' using errcode = 'P0001';
  end if;

  perform private.lock_live_session(v_session_id);
  select * into v_court from public.courts c where c.id = p_court_id for update;
  return v_court;
end;
$$;

-- Player of a live session the caller is staff of. Locks the session, then the player.
create function private.lock_live_player(p_player_id uuid)
returns public.session_players
language plpgsql
set search_path = ''
as $$
declare
  v_session_id uuid;
  v_club_id uuid;
  v_player public.session_players%rowtype;
begin
  select p.session_id, s.club_id into v_session_id, v_club_id
  from public.session_players p join public.sessions s on s.id = p.session_id
  where p.id = p_player_id;
  if not found or not public.is_club_staff(v_club_id) then
    raise exception 'player_not_found' using errcode = 'P0001';
  end if;

  perform private.lock_live_session(v_session_id);
  select * into v_player from public.session_players p where p.id = p_player_id for update;
  return v_player;
end;
$$;

-- Sends players to the end of the queue, in the given order (BR10/BR11).
create function private.requeue(p_player_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  foreach v_id in array p_player_ids loop
    update public.session_players
    set status = 'queued', queue_pos = nextval('public.session_players_queue_pos_seq')
    where id = v_id;
  end loop;
end;
$$;

-- First n eligible players, in queue order.
create function private.next_eligible(p_session_id uuid, p_count integer)
returns uuid[]
language sql
stable
set search_path = ''
as $$
  select coalesce(array_agg(e.player_id order by e.queue_pos), '{}')
  from (
    select player_id, queue_pos from private.eligible_players(p_session_id)
    order by queue_pos
    limit p_count
  ) e;
$$;

-- Starts a game on an empty court with these 4 players (call order kept).
create function private.start_game(p_court_id uuid, p_session_id uuid, p_player_ids uuid[])
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

  update public.session_players set status = 'playing' where id = any (p_player_ids);
  update public.courts set current_game_id = v_game_id where id = p_court_id;
  return v_game_id;
end;
$$;

-- Calls the first 4 eligible onto the court, or leaves it empty (BR8). Returns the game or null.
create function private.try_call(p_court_id uuid, p_session_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_players uuid[] := private.next_eligible(p_session_id, 4);
begin
  if cardinality(v_players) < 4 then
    return null;
  end if;
  return private.start_game(p_court_id, p_session_id, v_players);
end;
$$;

-- ---------------------------------------------------------------------------
-- Going live creates the courts (BR3). Replaces the Phase 2 helper, which
-- start_session and create_session(p_start => true) both call.
-- ---------------------------------------------------------------------------

create or replace function private.session_go_live(p_session_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_constraint text;
begin
  update public.sessions set status = 'live', started_at = now() where id = p_session_id;

  insert into public.courts (session_id, number, label)
  select s.id, n, 'Court ' || n
  from public.sessions s, generate_series(1, s.courts_count) n
  where s.id = p_session_id;
exception
  when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'sessions_one_live_per_club' then
      raise exception 'live_session_exists' using errcode = 'P0001';
    end if;
    raise;
end;
$$;

-- Sessions that went live before this migration get their courts now.
insert into public.courts (session_id, number, label)
select s.id, n, 'Court ' || n
from public.sessions s, generate_series(1, s.courts_count) n
where s.status = 'live'
  and not exists (select 1 from public.courts c where c.session_id = s.id);

-- ---------------------------------------------------------------------------
-- end_session (BR4): close running games (no winner, games_played unchanged),
-- free every court and mark every player left, in the same transaction.
-- ---------------------------------------------------------------------------

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
  update public.session_players set status = 'left' where session_id = p_session_id and status <> 'left';

  update public.sessions set status = 'ended', ended_at = now() where id = p_session_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPCs (security definer; live sessions only; staff only; anonymous refused)
-- ---------------------------------------------------------------------------

-- BR7/BR8: first 4 eligible onto an empty court. Returns the new game id.
-- With fewer than 4 eligible nothing changes; DETAIL holds how many are still needed.
create function public.call_next(p_court_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_court public.courts%rowtype;
  v_players uuid[];
begin
  perform private.assert_organizer_account();
  v_court := private.lock_live_court(p_court_id);

  if v_court.current_game_id is not null then
    raise exception 'court_busy' using errcode = 'P0001';
  end if;

  v_players := private.next_eligible(v_court.session_id, 4);
  if cardinality(v_players) < 4 then
    raise exception 'not_enough_players' using errcode = 'P0001', detail = (4 - cardinality(v_players))::text;
  end if;

  update public.courts set winner_streak = 0 where id = p_court_id;
  return private.start_game(p_court_id, v_court.session_id, v_players);
end;
$$;

-- Ends the court's running game and rotates (BR10/BR11/BR12). p_game_id makes a
-- double tap safe: a finished (or no longer current) game raises
-- 'game_already_finished' and changes nothing. Returns the next game id, or null
-- when the court stays empty.
create function public.finish_game(p_court_id uuid, p_game_id uuid, p_winner_ids uuid[] default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_court public.courts%rowtype;
  v_rotation text;
  v_game public.games%rowtype;
  v_winners uuid[];
  v_losers uuid[];
  v_streak integer;
begin
  perform private.assert_organizer_account();
  v_court := private.lock_live_court(p_court_id);
  select s.rotation into v_rotation from public.sessions s where s.id = v_court.session_id;

  select * into v_game from public.games g where g.id = p_game_id and g.court_id = p_court_id;
  if not found then
    raise exception 'game_not_found' using errcode = 'P0001';
  end if;
  if v_game.ended_at is not null or v_court.current_game_id is distinct from v_game.id then
    raise exception 'game_already_finished' using errcode = 'P0001';
  end if;

  if p_winner_ids is not null then
    if cardinality(p_winner_ids) <> 2 or not private.uuids_distinct(p_winner_ids)
       or not (p_winner_ids <@ v_game.player_ids) then
      raise exception 'invalid_winners' using errcode = 'P0001';
    end if;
  elsif v_rotation = 'winners_stay' then
    raise exception 'invalid_winners' using errcode = 'P0001';
  end if;

  update public.games set ended_at = now(), winner_ids = p_winner_ids where id = v_game.id;
  update public.session_players set games_played = games_played + 1 where id = any (v_game.player_ids);
  update public.courts set current_game_id = null where id = p_court_id;

  -- BR10: all four re-join the end of the queue in call order; call the next 4.
  if v_rotation = 'all_off' then
    perform private.requeue(v_game.player_ids);
    update public.courts set winner_streak = 0 where id = p_court_id;
    return private.try_call(p_court_id, v_court.session_id);
  end if;

  -- BR11: winners stay, at most 2 games in a row.
  v_winners := array(
    select p from unnest(v_game.player_ids) with ordinality u(p, i) where p = any (p_winner_ids) order by i
  );
  v_losers := array(
    select p from unnest(v_game.player_ids) with ordinality u(p, i) where p <> all (p_winner_ids) order by i
  );
  -- A game formed by stayers lists them first (see below), with streak > 0.
  v_streak := case
    when v_court.winner_streak > 0 and v_winners @> v_game.player_ids[1:2] then v_court.winner_streak + 1
    else 1
  end;

  -- Second win in a row, or fewer than 2 waiting: all four go off (winners
  -- first), the streak resets, and the court calls the first 4 as usual.
  if v_streak >= 2 or cardinality(private.next_eligible(v_court.session_id, 2)) < 2 then
    perform private.requeue(v_winners || v_losers);
    update public.courts set winner_streak = 0 where id = p_court_id;
    return private.try_call(p_court_id, v_court.session_id);
  end if;

  -- Losers re-join the end; the first 2 waiting join the winners.
  perform private.requeue(v_losers);
  update public.courts set winner_streak = v_streak where id = p_court_id;
  return private.start_game(
    p_court_id, v_court.session_id, v_winners || private.next_eligible(v_court.session_id, 2)
  );
end;
$$;

-- BR20: walk-in (no phone) at the end of the queue. Payment options: Phase 5.
create function public.add_walk_in(p_session_id uuid, p_display_name text, p_level text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player_id uuid;
begin
  perform private.assert_organizer_account();
  perform private.lock_live_session(p_session_id);

  insert into public.session_players (session_id, display_name, level, is_walk_in)
  values (p_session_id, p_display_name, p_level, true)
  returning id into v_player_id;
  return v_player_id;
end;
$$;

-- BR17: a paused player is skipped and keeps their place.
create function public.pause_player(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.session_players%rowtype;
begin
  perform private.assert_organizer_account();
  v_player := private.lock_live_player(p_player_id);
  if v_player.status <> 'queued' then
    raise exception 'invalid_player_status' using errcode = 'P0001';
  end if;
  update public.session_players set status = 'paused' where id = p_player_id;
end;
$$;

-- BR17: back to the same place (queue_pos unchanged).
create function public.resume_player(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.session_players%rowtype;
begin
  perform private.assert_organizer_account();
  v_player := private.lock_live_player(p_player_id);
  if v_player.status <> 'paused' then
    raise exception 'invalid_player_status' using errcode = 'P0001';
  end if;
  update public.session_players set status = 'queued' where id = p_player_id;
end;
$$;

-- BR18: removed players leave the queue (status 'left'). Not while playing.
create function public.remove_player(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.session_players%rowtype;
begin
  perform private.assert_organizer_account();
  v_player := private.lock_live_player(p_player_id);
  if v_player.status not in ('queued', 'paused') then
    raise exception 'invalid_player_status' using errcode = 'P0001';
  end if;
  update public.session_players set status = 'left' where id = p_player_id;
end;
$$;

-- How many can be called right now (BR6), for "Kailangan pa ng N player".
create function public.session_eligible_count(p_session_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_organizer_account();
  if not public.is_session_staff(p_session_id) then
    raise exception 'session_not_found' using errcode = 'P0001';
  end if;
  return (select count(*)::integer from private.eligible_players(p_session_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------

revoke execute on function
  private.uuids_distinct(uuid[]),
  private.eligible_players(uuid),
  private.lock_live_session(uuid),
  private.lock_live_court(uuid),
  private.lock_live_player(uuid),
  private.requeue(uuid[]),
  private.next_eligible(uuid, integer),
  private.start_game(uuid, uuid, uuid[]),
  private.try_call(uuid, uuid),
  public.session_players_before_write(),
  public.is_session_staff(uuid),
  public.call_next(uuid),
  public.finish_game(uuid, uuid, uuid[]),
  public.add_walk_in(uuid, text, text),
  public.pause_player(uuid),
  public.resume_player(uuid),
  public.remove_player(uuid),
  public.session_eligible_count(uuid)
from public, anon, authenticated;

grant execute on function
  public.is_session_staff(uuid),
  public.call_next(uuid),
  public.finish_game(uuid, uuid, uuid[]),
  public.add_walk_in(uuid, text, text),
  public.pause_player(uuid),
  public.resume_player(uuid),
  public.remove_player(uuid),
  public.session_eligible_count(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime (NF9): the Live screen subscribes; RLS decides who receives rows.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime
  add table public.sessions, public.session_players, public.courts, public.games;
