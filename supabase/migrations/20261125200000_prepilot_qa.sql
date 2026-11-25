-- Pre-pilot QA fixes (docs/qa/2026-11-qa-audit.md, QA-02 to QA-12).
--
-- Backward compatible with the app on main: every function keeps its name,
-- signature, grants, SECURITY DEFINER and search_path = ''. CREATE OR REPLACE
-- keeps existing grants. New error codes fall back to the app's generic
-- message on old clients. Sections are in finding order.

-- ===========================================================================
-- QA-02: "player is on court" (player_playing) is no longer the same error as
-- "already in that state" (invalid_player_status). The offline outbox counts
-- invalid_player_status as done; a refused Remove/Pause/Resume of a player who
-- was called meanwhile must not be.
-- ===========================================================================

create or replace function public.pause_player(p_player_id uuid)
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
  if v_player.status = 'playing' then
    raise exception 'player_playing' using errcode = 'P0001';
  end if;
  if v_player.status <> 'queued' then
    raise exception 'invalid_player_status' using errcode = 'P0001';
  end if;
  update public.session_players set status = 'paused' where id = p_player_id;
end;
$$;

create or replace function public.resume_player(p_player_id uuid)
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
  if v_player.status = 'playing' then
    raise exception 'player_playing' using errcode = 'P0001';
  end if;
  if v_player.status <> 'paused' then
    raise exception 'invalid_player_status' using errcode = 'P0001';
  end if;
  update public.session_players set status = 'queued' where id = p_player_id;
end;
$$;

create or replace function public.remove_player(p_player_id uuid)
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
  if v_player.status = 'playing' then
    raise exception 'player_playing' using errcode = 'P0001';
  end if;
  if v_player.status not in ('queued', 'paused') then
    raise exception 'invalid_player_status' using errcode = 'P0001';
  end if;
  update public.session_players set status = 'left' where id = p_player_id;

  perform private.log_undoable(
    v_player.session_id,
    'player_removed',
    jsonb_build_object('player_id', p_player_id),
    jsonb_build_object('status', v_player.status, 'not_ready_at', v_player.not_ready_at)
  );
end;
$$;

-- ===========================================================================
-- QA-03 / D23: Winners stay with fewer than 2 players waiting. Everyone goes
-- off with the LOSERS FIRST, then the winners, so a winner sits out (5 players
-- doubles: the waiting player, both losers and one winner play next; 3 players
-- singles: the waiting player and the loser). Before D23 the winners were put
-- first and were called straight back every game. With 2 or more waiting
-- nothing changes: winners stay for at most 2 wins in a row, then all four go
-- off (winners first).
-- ===========================================================================

create or replace function private.finish_game_rotate(p_court_id uuid, p_game_id uuid, p_winner_ids uuid[])
returns uuid
language plpgsql
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

  if v_rotation = 'all_off' then
    perform private.requeue(v_game.player_ids);
    update public.courts set winner_streak = 0 where id = p_court_id;
    return private.try_call(p_court_id, v_court.session_id);
  end if;

  v_winners := array(
    select p from unnest(v_game.player_ids) with ordinality u(p, i) where p = any (p_winner_ids) order by i
  );
  v_losers := array(
    select p from unnest(v_game.player_ids) with ordinality u(p, i) where p <> all (p_winner_ids) order by i
  );

  -- D23: fewer than 2 waiting: everyone goes off, losers first, so a winner sits out.
  if cardinality(private.next_eligible(v_court.session_id, 2)) < 2 then
    perform private.requeue(v_losers || v_winners);
    update public.courts set winner_streak = 0 where id = p_court_id;
    return private.try_call(p_court_id, v_court.session_id);
  end if;

  v_streak := case
    when v_court.winner_streak > 0 and v_winners @> v_game.player_ids[1:v_needed] then v_court.winner_streak + 1
    else 1
  end;

  -- BR11: second win in a row: all four go off (winners first) and the next group is called.
  if v_streak >= 2 then
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
