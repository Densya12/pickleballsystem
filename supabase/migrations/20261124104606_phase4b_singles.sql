-- Phase 4b: singles courts.
--
-- The organizer sets each court as doubles (4 players) or singles (2). Players
-- don't opt in: the next eligible players in the shared queue are called, and
-- anyone who doesn't want singles uses "Hindi pa ako handa" (Phase 4, BR19).
--
-- Everywhere the code assumed 4 now asks the court's format. Eligibility is
-- still only private.eligible_players.

-- ---------------------------------------------------------------------------
-- Sizes
-- ---------------------------------------------------------------------------

-- Players per game on a court of this format.
create function private.court_size(p_format text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_format when 'singles' then 2 else 4 end;
$$;

-- Winners per game (winners stay): the side that won.
create function private.winners_needed(p_format text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_format when 'singles' then 1 else 2 end;
$$;

-- ---------------------------------------------------------------------------
-- sessions.court_formats: one entry per court, all 'doubles' unless given.
-- ---------------------------------------------------------------------------

alter table public.sessions add column court_formats text[];

-- Fill a missing plan with doubles (otherwise unchanged from Phase 2).
create or replace function public.sessions_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := btrim(new.name);
  if new.court_formats is null then
    new.court_formats := array_fill('doubles'::text, array[new.courts_count]);
  end if;

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

-- Backfill: every existing session was all doubles.
update public.sessions set court_formats = array_fill('doubles'::text, array[courts_count]) where court_formats is null;

alter table public.sessions
  alter column court_formats set not null,
  add constraint sessions_court_formats_valid check (
    cardinality(court_formats) = courts_count
    and array_position(court_formats, null) is null
    and court_formats <@ array['doubles', 'singles']::text[]
  );

grant select (court_formats) on public.sessions to authenticated;

-- ---------------------------------------------------------------------------
-- courts.format and games.format (existing rows: doubles)
-- ---------------------------------------------------------------------------

alter table public.courts
  add column format text not null default 'doubles',
  add constraint courts_format_allowed check (format in ('doubles', 'singles'));

alter table public.games
  add column format text not null default 'doubles',
  add constraint games_format_allowed check (format in ('doubles', 'singles'));

-- Player and winner counts follow the game's format.
alter table public.games
  drop constraint games_four_players,
  drop constraint games_two_winners,
  add constraint games_players_match_format check (
    cardinality(player_ids) = private.court_size(format) and private.uuids_distinct(player_ids)
  ),
  add constraint games_winners_match_format check (
    winner_ids is null
    or (cardinality(winner_ids) = private.winners_needed(format)
        and private.uuids_distinct(winner_ids)
        and winner_ids <@ player_ids)
  );

-- ---------------------------------------------------------------------------
-- create_session: optional p_court_formats (null = all doubles). Dropped and
-- recreated (not overloaded) so calls stay unambiguous.
-- ---------------------------------------------------------------------------

drop function public.create_session(uuid, text, timestamptz, timestamptz, integer, integer, text, boolean, integer, boolean);

create function public.create_session(
  p_club_id       uuid,
  p_name          text,
  p_starts_at     timestamptz,
  p_ends_at       timestamptz,
  p_courts_count  integer,
  p_points_to     integer default null,
  p_rotation      text default null,
  p_pay_first     boolean default false,
  p_fee           integer default null,
  p_start         boolean default false,
  p_court_formats text[] default null
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
        club_id, name, starts_at, ends_at, courts_count, court_formats, points_to, rotation,
        pay_first, fee, gcash_name, gcash_number, created_by
      ) values (
        p_club_id, p_name, p_starts_at, p_ends_at, p_courts_count, p_court_formats,
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

-- Going live creates each court with its planned format (BR3).
create or replace function private.session_go_live(p_session_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_constraint text;
begin
  update public.sessions set status = 'live', started_at = now() where id = p_session_id;

  insert into public.courts (session_id, number, label, format)
  select s.id, n, 'Court ' || n, s.court_formats[n]
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

-- ---------------------------------------------------------------------------
-- Calling and rotating by the court's size
-- ---------------------------------------------------------------------------

-- The game records the court's format at the time it starts.
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

  insert into public.games (session_id, court_id, number, player_ids, format)
  select p_session_id, p_court_id, v_number, p_player_ids, c.format
  from public.courts c where c.id = p_court_id
  returning id into v_game_id;

  update public.session_players set status = 'playing', not_ready_at = null where id = any (p_player_ids);
  update public.courts set current_game_id = v_game_id where id = p_court_id;
  return v_game_id;
end;
$$;

-- Calls a full group for the court (2 singles, 4 doubles), or leaves it empty (BR8).
create or replace function private.try_call(p_court_id uuid, p_session_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_size integer := (select private.court_size(c.format) from public.courts c where c.id = p_court_id);
  v_players uuid[] := private.next_eligible(p_session_id, v_size);
begin
  if cardinality(v_players) < v_size then
    return null;
  end if;
  return private.start_game(p_court_id, p_session_id, v_players);
end;
$$;

-- BR7/BR8 by court size. DETAIL holds how many are still needed.
create or replace function public.call_next(p_court_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_court public.courts%rowtype;
  v_size integer;
  v_players uuid[];
begin
  perform private.assert_organizer_account();
  v_court := private.lock_live_court(p_court_id);

  if v_court.current_game_id is not null then
    raise exception 'court_busy' using errcode = 'P0001';
  end if;

  v_size := private.court_size(v_court.format);
  v_players := private.next_eligible(v_court.session_id, v_size);
  if cardinality(v_players) < v_size then
    raise exception 'not_enough_players' using errcode = 'P0001', detail = (v_size - cardinality(v_players))::text;
  end if;

  update public.courts set winner_streak = 0 where id = p_court_id;
  return private.start_game(p_court_id, v_court.session_id, v_players);
end;
$$;

-- Ends the court's running game and rotates (BR10/BR11/BR12), for either
-- format. Winners: 2 in doubles, 1 in singles. The winning side stays for up
-- to 2 wins in a row; with too few waiting to fill the other side, everyone
-- re-joins (winners first) and the normal call runs.
create or replace function public.finish_game(p_court_id uuid, p_game_id uuid, p_winner_ids uuid[] default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_court public.courts%rowtype;
  v_rotation text;
  v_game public.games%rowtype;
  v_needed integer;
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

  v_needed := private.winners_needed(v_game.format);
  if p_winner_ids is not null then
    if cardinality(p_winner_ids) <> v_needed or not private.uuids_distinct(p_winner_ids)
       or not (p_winner_ids <@ v_game.player_ids) then
      raise exception 'invalid_winners' using errcode = 'P0001';
    end if;
  elsif v_rotation = 'winners_stay' then
    raise exception 'invalid_winners' using errcode = 'P0001';
  end if;

  update public.games set ended_at = now(), winner_ids = p_winner_ids where id = v_game.id;
  update public.session_players set games_played = games_played + 1 where id = any (v_game.player_ids);
  update public.courts set current_game_id = null where id = p_court_id;

  -- BR10: everyone re-joins the end in call order; call the next group.
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
  -- A game formed by stayers lists them first, with streak > 0.
  v_streak := case
    when v_court.winner_streak > 0 and v_winners @> v_game.player_ids[1:v_needed] then v_court.winner_streak + 1
    else 1
  end;

  if v_streak >= 2 or cardinality(private.next_eligible(v_court.session_id, v_needed)) < v_needed then
    perform private.requeue(v_winners || v_losers);
    update public.courts set winner_streak = 0 where id = p_court_id;
    return private.try_call(p_court_id, v_court.session_id);
  end if;

  perform private.requeue(v_losers);
  update public.courts set winner_streak = v_streak where id = p_court_id;
  return private.start_game(
    p_court_id, v_court.session_id, v_winners || private.next_eligible(v_court.session_id, v_needed)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- set_court_format: organizer, live session, empty court only.
-- ---------------------------------------------------------------------------

create function public.set_court_format(p_court_id uuid, p_format text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_court public.courts%rowtype;
begin
  perform private.assert_organizer_account();
  v_court := private.lock_live_court(p_court_id);

  if v_court.current_game_id is not null then
    raise exception 'court_busy' using errcode = 'P0001';
  end if;
  if p_format is null or p_format not in ('doubles', 'singles') then
    raise exception 'invalid_format' using errcode = 'P0001';
  end if;

  update public.courts set format = p_format, winner_streak = 0 where id = p_court_id;
  -- Keep the session's plan in step with its courts.
  update public.sessions set court_formats[v_court.number] = p_format where id = v_court.session_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------

revoke execute on function
  private.court_size(text),
  private.winners_needed(text),
  public.create_session(uuid, text, timestamptz, timestamptz, integer, integer, text, boolean, integer, boolean, text[]),
  public.set_court_format(uuid, text)
from public, anon, authenticated;

grant execute on function
  public.create_session(uuid, text, timestamptz, timestamptz, integer, integer, text, boolean, integer, boolean, text[]),
  public.set_court_format(uuid, text)
to authenticated;
