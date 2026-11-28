-- Phase 9.2a: Match log and Standings (spec D27).
--
-- 1. public.correct_game: the organizer corrects a finished game's result
--    and/or its teams (the same players in another order). It changes the
--    record only: courts, the queue, games_played, winner_streak and
--    stayed_ids are not touched. Logged ('game_corrected', BR16: who, when,
--    before and after). The games row update bumps the session change
--    counter (games_count_change trigger) and the event becomes the latest,
--    so a pending Undo of an older action is no longer offered.
-- 2. public.session_standings: wins, losses and games per player for the
--    session, ranked (wins desc, then losses asc; ties share a rank). For the
--    session's staff and its players (the queue_preview access pattern).
--
-- New functions only: no existing function, table, policy or grant changes.
-- Existing games keep working; a null winner_ids is "No result".

-- ===========================================================================
-- 1. CORRECT A FINISHED GAME
-- ===========================================================================

create or replace function public.correct_game(p_game_id uuid, p_player_ids uuid[], p_winner_ids uuid[] default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_id uuid;
  v_session public.sessions%rowtype;
  v_game public.games%rowtype;
  v_half integer;
  v_left uuid[];
  v_right uuid[];
  v_winners uuid[];
begin
  perform private.assert_organizer_account();

  select g.session_id into v_session_id from public.games g where g.id = p_game_id;
  if not found or not public.is_session_staff(v_session_id) then
    raise exception 'game_not_found' using errcode = 'P0001';
  end if;

  -- Lock order as everywhere: the session, then the game.
  v_session := private.lock_staff_session(v_session_id);
  if v_session.status not in ('live', 'ended') then
    raise exception 'session_not_started' using errcode = 'P0001';
  end if;
  select * into v_game from public.games g where g.id = p_game_id for update;
  if v_game.ended_at is null then
    raise exception 'game_not_finished' using errcode = 'P0001';
  end if;

  -- The same players, in any order (nobody added or removed).
  if p_player_ids is null
     or cardinality(p_player_ids) <> cardinality(v_game.player_ids)
     or not private.uuids_distinct(p_player_ids)
     or not (p_player_ids @> v_game.player_ids and v_game.player_ids @> p_player_ids) then
    raise exception 'invalid_players' using errcode = 'P0001';
  end if;

  -- The winners: nobody (no result) or exactly one full side, stored in position order.
  v_half := private.winners_needed(v_game.format);
  v_left := p_player_ids[1:v_half];
  v_right := p_player_ids[v_half + 1:v_half * 2];
  if p_winner_ids is null then
    v_winners := null;
  elsif cardinality(p_winner_ids) = v_half and private.uuids_distinct(p_winner_ids) and p_winner_ids @> v_left and v_left @> p_winner_ids then
    v_winners := v_left;
  elsif cardinality(p_winner_ids) = v_half and private.uuids_distinct(p_winner_ids) and p_winner_ids @> v_right and v_right @> p_winner_ids then
    v_winners := v_right;
  else
    raise exception 'invalid_winners' using errcode = 'P0001';
  end if;

  -- Nothing to change (e.g. sent twice): no write, no event.
  if v_game.player_ids = p_player_ids and v_game.winner_ids is not distinct from v_winners then
    return;
  end if;

  update public.games set player_ids = p_player_ids, winner_ids = v_winners where id = v_game.id;

  insert into public.events (session_id, actor, type, payload)
  values (v_session_id, auth.uid(), 'game_corrected', jsonb_build_object(
    'game_id', v_game.id,
    'number', v_game.number,
    'before', jsonb_build_object('player_ids', to_jsonb(v_game.player_ids), 'winner_ids', to_jsonb(v_game.winner_ids)),
    'after', jsonb_build_object('player_ids', to_jsonb(p_player_ids), 'winner_ids', to_jsonb(v_winners))
  ));
end;
$$;

revoke execute on function public.correct_game(uuid, uuid[], uuid[]) from public, anon, authenticated;
grant execute on function public.correct_game(uuid, uuid[], uuid[]) to authenticated;

-- ===========================================================================
-- 2. STANDINGS
-- ===========================================================================

-- One row per player with at least one finished game (players who left too).
-- A game with no result counts in games, not in wins or losses.
create or replace function public.session_standings(p_session_id uuid)
returns table (session_player_id uuid, display_name text, wins integer, losses integer, games integer, rank integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if p_session_id is null or not (public.is_session_staff(p_session_id) or public.is_session_player(p_session_id)) then
    raise exception 'session_not_found' using errcode = 'P0001';
  end if;

  return query
  with played as (
    select u.player_id, g.winner_ids
    from public.games g
    cross join lateral unnest(g.player_ids) as u(player_id)
    where g.session_id = p_session_id and g.ended_at is not null
  ),
  totals as (
    select pl.player_id,
           (count(*) filter (where pl.winner_ids is not null and pl.player_id = any (pl.winner_ids)))::integer as w,
           (count(*) filter (where pl.winner_ids is not null and not (pl.player_id = any (pl.winner_ids))))::integer as l,
           count(*)::integer as n
    from played pl
    group by pl.player_id
  )
  select t.player_id, sp.display_name, t.w, t.l, t.n,
         (rank() over (order by t.w desc, t.l asc))::integer
  from totals t
  join public.session_players sp on sp.id = t.player_id
  order by t.w desc, t.l asc, lower(sp.display_name), sp.display_name, t.player_id;
end;
$$;

revoke execute on function public.session_standings(uuid) from public, anon, authenticated;
grant execute on function public.session_standings(uuid) to authenticated;
