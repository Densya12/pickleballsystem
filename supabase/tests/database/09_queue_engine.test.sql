-- Phase 3 queue engine: BR3, BR5, BR6, BR7, BR8, BR10, BR11, BR12, BR17,
-- BR18, BR20, double finish, invariants, end_session cleanup.
-- Run: npm run test:db   (needs the local stack: npx supabase start)
begin;
select plan(84);

create function pg_temp.as_user(p_sub uuid, p_extra jsonb default '{}') returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    (jsonb_build_object('sub', p_sub, 'role', 'authenticated') || p_extra)::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create function pg_temp.sid(p_key text) returns uuid language sql as $$
  select current_setting('test.' || p_key)::uuid;
$$;
create function pg_temp.pid(p_session uuid, p_name text) returns uuid language sql as $$
  select id from public.session_players where session_id = p_session and display_name = p_name;
$$;
create function pg_temp.court(p_session uuid, p_number int) returns uuid language sql as $$
  select id from public.courts where session_id = p_session and number = p_number;
$$;
create function pg_temp.cur(p_session uuid, p_number int) returns uuid language sql as $$
  select current_game_id from public.courts where session_id = p_session and number = p_number;
$$;
-- Names of an id list, in list order.
create function pg_temp.names(p_ids uuid[]) returns text language sql as $$
  select string_agg(p.display_name, ',' order by u.i)
  from unnest(p_ids) with ordinality u(id, i) join public.session_players p on p.id = u.id;
$$;
create function pg_temp.on_court(p_session uuid, p_number int) returns text language sql as $$
  select pg_temp.names(g.player_ids) from public.games g where g.id = pg_temp.cur(p_session, p_number);
$$;
-- Queued players (eligible order), comma separated.
create function pg_temp.queue(p_session uuid) returns text language sql as $$
  select coalesce(string_agg(display_name, ',' order by queue_pos), '')
  from public.session_players where session_id = p_session and status = 'queued';
$$;
create function pg_temp.played(p_session uuid, p_names text[]) returns int[] language sql as $$
  select array_agg(p.games_played order by u.i)
  from unnest(p_names) with ordinality u(n, i) join public.session_players p on p.display_name = u.n and p.session_id = p_session;
$$;
-- 'message' or 'message:detail' of an error, or 'no error'. Rolls back the statement.
create function pg_temp.err(p_sql text) returns text language plpgsql as $$
declare v_msg text; v_detail text;
begin
  execute p_sql;
  return 'no error';
exception when others then
  get stacked diagnostics v_msg = message_text, v_detail = pg_exception_detail;
  return v_msg || coalesce(':' || nullif(v_detail, ''), '');
end;
$$;
-- Nobody on two courts; nobody playing without a running game or queued while in one;
-- every court points at its running game.
create function pg_temp.invariants_ok(p_session uuid) returns boolean language sql as $$
  select
    not exists (
      select x from public.games g, unnest(g.player_ids) x
      where g.session_id = p_session and g.ended_at is null group by x having count(*) > 1)
    and not exists (
      select 1 from public.games g cross join unnest(g.player_ids) x join public.session_players p on p.id = x
      where g.session_id = p_session and g.ended_at is null and p.status <> 'playing')
    and not exists (
      select 1 from public.session_players p
      where p.session_id = p_session and p.status = 'playing'
        and not exists (select 1 from public.games g where g.ended_at is null and p.id = any (g.player_ids)))
    and not exists (
      select 1 from public.courts c left join public.games g on g.court_id = c.id and g.ended_at is null
      where c.session_id = p_session and c.current_game_id is distinct from g.id);
$$;

insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.com'),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'organizer@example.com');

-- One club per scenario (a club has at most one live session).
insert into public.clubs (id, name, created_by, default_rotation) values
  ('a1111111-0000-0000-0000-000000000000', 'All Off Club', '11111111-1111-1111-1111-111111111111', 'all_off'),
  ('a2222222-0000-0000-0000-000000000000', 'Winners Club', '11111111-1111-1111-1111-111111111111', 'winners_stay'),
  ('a3333333-0000-0000-0000-000000000000', 'Small Club', '11111111-1111-1111-1111-111111111111', 'all_off');
insert into public.club_staff (club_id, user_id, role)
select c, '11111111-1111-1111-1111-111111111111', 'owner'
from unnest(array['a1111111-0000-0000-0000-000000000000', 'a2222222-0000-0000-0000-000000000000', 'a3333333-0000-0000-0000-000000000000']::uuid[]) c;
-- The organizer (not owner) runs the all-off session.
insert into public.club_staff (club_id, user_id, role)
values ('a1111111-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'organizer');

-- ===========================================================================
-- BR3: courts appear when the session goes live
-- ===========================================================================
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select set_config('test.s1', public.create_session(
  'a1111111-0000-0000-0000-000000000000', 'All Off Night', now(), now() + interval '3h', 2)::text, true);
select is((select count(*)::int from public.courts where session_id = pg_temp.sid('s1')), 0, 'BR3: a draft has no courts');
select lives_ok($$ select public.start_session(pg_temp.sid('s1')) $$, 'Organizer starts the session');
select results_eq(
  $$ select number, label, current_game_id, winner_streak from public.courts where session_id = pg_temp.sid('s1') order by number $$,
  $$ values (1, 'Court 1'::text, null::uuid, 0), (2, 'Court 2'::text, null::uuid, 0) $$,
  'BR3: start_session creates Court 1..N, all empty');
reset role;

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select set_config('test.s3', public.create_session(
  'a2222222-0000-0000-0000-000000000000', 'Winners Night', now(), now() + interval '3h', 3, p_start => true)::text, true);
select is((select array_agg(label order by number)::text from public.courts where session_id = pg_temp.sid('s3')),
  '{"Court 1","Court 2","Court 3"}', 'BR3: create-and-start creates the courts too');
reset role;

-- ===========================================================================
-- BR20 + BR5: walk-ins join the end of the queue
-- ===========================================================================
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select public.add_walk_in(pg_temp.sid('s1'), 'P' || n, 'intermediate', 'later') from generate_series(1, 9) n;
select is(pg_temp.queue(pg_temp.sid('s1')), 'P1,P2,P3,P4,P5,P6,P7,P8,P9', 'BR5/BR20: walk-ins queue in the order they were added');
select ok((select bool_and(is_walk_in and status = 'queued' and games_played = 0) from public.session_players where session_id = pg_temp.sid('s1')),
  'Walk-ins are queued, marked as walk-ins, with 0 games');
select lives_ok($$ select public.add_walk_in(pg_temp.sid('s1'), '   Tito    Boy  ', 'unsure', 'later') $$, 'A walk-in name is tidied');
select is((select display_name from public.session_players where session_id = pg_temp.sid('s1') order by queue_pos desc limit 1),
  'Tito Boy', 'Spaces are trimmed and collapsed');
select throws_ok($$ select public.add_walk_in(pg_temp.sid('s1'), 'X', 'beginner', 'later') $$, '23514', null,
  'A 1-character name is refused');
select throws_ok($$ select public.add_walk_in(pg_temp.sid('s1'), 'Pro Player', 'pro', 'later') $$, '23514', null,
  'An unknown level is refused');
select lives_ok($$ select public.remove_player(pg_temp.pid(pg_temp.sid('s1'), 'Tito Boy')) $$, 'BR18: remove a queued player');
select is((select status from public.session_players where id = pg_temp.pid(pg_temp.sid('s1'), 'Tito Boy')), 'left', 'BR18: removed means left');

-- ===========================================================================
-- BR7: call_next takes the first 4 eligible
-- ===========================================================================
select set_config('test.g1', public.call_next(pg_temp.court(pg_temp.sid('s1'), 1))::text, true);
select is(pg_temp.on_court(pg_temp.sid('s1'), 1), 'P1,P2,P3,P4', 'BR7: Court 1 calls P1-P4 in queue order');
select results_eq($$ select number, court_id, ended_at, winner_ids from public.games where id = pg_temp.sid('g1') $$,
  $$ values (1, pg_temp.court(pg_temp.sid('s1'), 1), null::timestamptz, null::uuid[]) $$, 'Game #1 is running on Court 1');
select is((select array_agg(distinct status) from public.session_players where id = any ((select player_ids from public.games where id = pg_temp.sid('g1'))::uuid[]))::text,
  '{playing}', 'Called players are playing');
select is(pg_temp.queue(pg_temp.sid('s1')), 'P5,P6,P7,P8,P9', 'They left the queue');
select is(pg_temp.err($$ select public.call_next(pg_temp.court(pg_temp.sid('s1'), 1)) $$), 'court_busy',
  'call_next on a busy court is refused');
select ok(pg_temp.invariants_ok(pg_temp.sid('s1')), 'Invariants hold after the first call');

-- ===========================================================================
-- BR17 / BR6: paused players are skipped and keep their place
-- ===========================================================================
select set_config('test.p5_pos', (select queue_pos::text from public.session_players where id = pg_temp.pid(pg_temp.sid('s1'), 'P5')), true);
select lives_ok($$ select public.pause_player(pg_temp.pid(pg_temp.sid('s1'), 'P5')) $$, 'BR17: pause P5');
select is(public.session_eligible_count(pg_temp.sid('s1')), 4, 'BR6: paused players are not eligible');
select set_config('test.g2', public.call_next(pg_temp.court(pg_temp.sid('s1'), 2))::text, true);
select is(pg_temp.on_court(pg_temp.sid('s1'), 2), 'P6,P7,P8,P9', 'BR6/BR17: Court 2 skips paused P5');
select is((select number from public.games where id = pg_temp.sid('g2')), 2, 'Game numbers count up per session');
-- QA-02: a player on court gets its own code (player_playing), not invalid_player_status.
select is(pg_temp.err($$ select public.resume_player(pg_temp.pid(pg_temp.sid('s1'), 'P6')) $$), 'player_playing',
  'Only paused players can be resumed (a playing player: player_playing)');
select is(pg_temp.err($$ select public.pause_player(pg_temp.pid(pg_temp.sid('s1'), 'P6')) $$), 'player_playing',
  'A playing player cannot be paused (player_playing)');
select is(pg_temp.err($$ select public.remove_player(pg_temp.pid(pg_temp.sid('s1'), 'P6')) $$), 'player_playing',
  'A playing player cannot be removed (player_playing)');
select is(pg_temp.err($$ select public.pause_player(pg_temp.pid(pg_temp.sid('s1'), 'P5')) $$), 'invalid_player_status',
  'A paused player cannot be paused again');
select lives_ok($$ select public.resume_player(pg_temp.pid(pg_temp.sid('s1'), 'P5')) $$, 'BR17: resume P5');
select results_eq(
  $$ select status, queue_pos::text from public.session_players where id = pg_temp.pid(pg_temp.sid('s1'), 'P5') $$,
  $$ values ('queued'::text, current_setting('test.p5_pos')) $$, 'BR17: P5 is back in the same place');
select ok(pg_temp.invariants_ok(pg_temp.sid('s1')), 'Invariants hold with both courts busy');

-- ===========================================================================
-- BR10 + BR12: all off, then the next 4 are called automatically
-- ===========================================================================
select set_config('test.g3', public.finish_game(pg_temp.court(pg_temp.sid('s1'), 1), pg_temp.sid('g1'))::text, true);
select ok((select ended_at is not null and winner_ids is null from public.games where id = pg_temp.sid('g1')), 'Game #1 ended, no winners in all off');
select is(pg_temp.played(pg_temp.sid('s1'), array['P1','P2','P3','P4','P5']), array[1,1,1,1,0], 'BR12: the 4 players get +1 game');
select is(pg_temp.on_court(pg_temp.sid('s1'), 1), 'P5,P1,P2,P3', 'BR10: all four re-joined the end in call order; Court 1 called P5,P1,P2,P3');
select is((select number from public.games where id = pg_temp.sid('g3')), 3, 'finish_game returns the next game (#3)');
select is(pg_temp.queue(pg_temp.sid('s1')), 'P4', 'P4 waits at the front');
select ok(pg_temp.invariants_ok(pg_temp.sid('s1')), 'Invariants hold after rotation');

-- Double tap: the same game again changes nothing and calls nobody twice.
select set_config('test.before', (select string_agg(id || status || queue_pos || games_played, ';' order by id) from public.session_players where session_id = pg_temp.sid('s1')), true);
select is(pg_temp.err($$ select public.finish_game(pg_temp.court(pg_temp.sid('s1'), 1), pg_temp.sid('g1')) $$), 'game_already_finished',
  'Double tap: finishing game #1 again is refused');
select is((select string_agg(id || status || queue_pos || games_played, ';' order by id) from public.session_players where session_id = pg_temp.sid('s1')),
  current_setting('test.before'), 'Double tap: no player changed (nobody re-queued or called twice)');
select is((select count(*)::int from public.games where session_id = pg_temp.sid('s1')), 3, 'Double tap: no extra game');
select is(pg_temp.cur(pg_temp.sid('s1'), 1), pg_temp.sid('g3'), 'Double tap: Court 1 still runs game #3');
select is(pg_temp.err($$ select public.finish_game(pg_temp.court(pg_temp.sid('s1'), 2), pg_temp.sid('g1')) $$), 'game_not_found',
  'A game id from another court is refused');
select is(pg_temp.err($$ select public.finish_game(pg_temp.court(pg_temp.sid('s1'), 1), pg_temp.sid('g3'), array[pg_temp.pid(pg_temp.sid('s1'), 'P5'), pg_temp.pid(pg_temp.sid('s1'), 'P9')]) $$),
  'invalid_winners', 'Winners must be players of the game');

-- Court 2 finishes; P6-P9 go to the end behind P4.
select set_config('test.g4', public.finish_game(pg_temp.court(pg_temp.sid('s1'), 2), pg_temp.sid('g2'))::text, true);
select is(pg_temp.on_court(pg_temp.sid('s1'), 2), 'P4,P6,P7,P8', 'BR10: Court 2 calls P4 first, then the re-queued players');
select is(pg_temp.queue(pg_temp.sid('s1')), 'P9', 'P9 waits');
select ok(pg_temp.invariants_ok(pg_temp.sid('s1')), 'Invariants hold');
reset role;

-- ===========================================================================
-- BR8: fewer than 4 eligible changes nothing
-- ===========================================================================
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select set_config('test.s2', public.create_session(
  'a3333333-0000-0000-0000-000000000000', 'Small Night', now(), now() + interval '3h', 1, p_start => true)::text, true);
select public.add_walk_in(pg_temp.sid('s2'), 'S' || n, 'beginner', 'later') from generate_series(1, 3) n;
select is(pg_temp.err($$ select public.call_next(pg_temp.court(pg_temp.sid('s2'), 1)) $$), 'not_enough_players:1',
  'BR8: 3 eligible -> not_enough_players, 1 still needed');
select lives_ok($$ select public.pause_player(pg_temp.pid(pg_temp.sid('s2'), 'S1')) $$, 'Pause one');
select is(pg_temp.err($$ select public.call_next(pg_temp.court(pg_temp.sid('s2'), 1)) $$), 'not_enough_players:2',
  'BR8: paused players do not count; 2 still needed');
select results_eq(
  $$ select (select count(*)::int from public.games where session_id = pg_temp.sid('s2')), pg_temp.cur(pg_temp.sid('s2'), 1), pg_temp.queue(pg_temp.sid('s2')) $$,
  $$ values (0, null::uuid, 'S2,S3'::text) $$, 'BR8: no game, the court stays empty, the queue is unchanged');
select lives_ok($$ select public.remove_player(pg_temp.pid(pg_temp.sid('s2'), 'S1')) $$, 'BR18: a paused player can be removed');
select is((select status from public.session_players where id = pg_temp.pid(pg_temp.sid('s2'), 'S1')), 'left', 'Removed while paused: left');
select is(pg_temp.err($$ select public.resume_player(pg_temp.pid(pg_temp.sid('s2'), 'S1')) $$), 'invalid_player_status',
  'A player who left cannot be resumed');
reset role;

-- ===========================================================================
-- BR11: winners stay (3 courts; only Court 1 used)
-- ===========================================================================
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.add_walk_in(pg_temp.sid('s3'), 'W' || n, 'advanced', 'later') from generate_series(1, 8) n;
select set_config('test.w1', public.call_next(pg_temp.court(pg_temp.sid('s3'), 1))::text, true);
select is(pg_temp.on_court(pg_temp.sid('s3'), 1), 'W1,W2,W3,W4', 'Game #1: W1-W4');

select is(pg_temp.err($$ select public.finish_game(pg_temp.court(pg_temp.sid('s3'), 1), pg_temp.sid('w1')) $$), 'invalid_winners',
  'BR11: winners are required in winners stay');
select is(pg_temp.err($$ select public.finish_game(pg_temp.court(pg_temp.sid('s3'), 1), pg_temp.sid('w1'), array[pg_temp.pid(pg_temp.sid('s3'), 'W1')]) $$),
  'invalid_winners', 'BR11: exactly 2 winners');
select is(pg_temp.err($$ select public.finish_game(pg_temp.court(pg_temp.sid('s3'), 1), pg_temp.sid('w1'), array[pg_temp.pid(pg_temp.sid('s3'), 'W1'), pg_temp.pid(pg_temp.sid('s3'), 'W1')]) $$),
  'invalid_winners', 'BR11: two different winners');
select is(pg_temp.err($$ select public.finish_game(pg_temp.court(pg_temp.sid('s3'), 1), pg_temp.sid('w1'), array[pg_temp.pid(pg_temp.sid('s3'), 'W1'), pg_temp.pid(pg_temp.sid('s3'), 'W5')]) $$),
  'invalid_winners', 'BR11: winners must have played the game');

-- Game 1: W3 + W1 win -> they stay (streak 1); losers W2, W4 to the end; W5, W6 join.
select set_config('test.w2', public.finish_game(pg_temp.court(pg_temp.sid('s3'), 1), pg_temp.sid('w1'),
  array[pg_temp.pid(pg_temp.sid('s3'), 'W3'), pg_temp.pid(pg_temp.sid('s3'), 'W1')])::text, true);
select is((select pg_temp.names(winner_ids) from public.games where id = pg_temp.sid('w1')), 'W3,W1', 'The winners are saved on the game');
select is(pg_temp.on_court(pg_temp.sid('s3'), 1), 'W1,W3,W5,W6', 'BR11: winners stay (listed first), the first 2 waiting join');
select is((select winner_streak from public.courts where id = pg_temp.court(pg_temp.sid('s3'), 1)), 1, 'BR11: streak 1');
select is(pg_temp.queue(pg_temp.sid('s3')), 'W7,W8,W2,W4', 'BR11: losers re-joined the end');
select is(pg_temp.played(pg_temp.sid('s3'), array['W1','W2','W3','W4','W5']), array[1,1,1,1,0], 'BR12 in winners stay');

-- Game 2: the stayers win again -> streak 2 -> all four off (winners first), streak resets, next 4 called.
select set_config('test.w3', public.finish_game(pg_temp.court(pg_temp.sid('s3'), 1), pg_temp.sid('w2'),
  array[pg_temp.pid(pg_temp.sid('s3'), 'W1'), pg_temp.pid(pg_temp.sid('s3'), 'W3')])::text, true);
select is(pg_temp.on_court(pg_temp.sid('s3'), 1), 'W7,W8,W2,W4', 'BR11: after 2 wins in a row all four go off; the next 4 are called');
select is(pg_temp.queue(pg_temp.sid('s3')), 'W1,W3,W5,W6', 'BR11: winners re-joined first, then losers');
select is((select winner_streak from public.courts where id = pg_temp.court(pg_temp.sid('s3'), 1)), 0, 'BR11: streak reset');
select is(pg_temp.played(pg_temp.sid('s3'), array['W1','W3','W5','W6']), array[2,2,1,1], 'BR12: counts keep adding up');

-- Game 3 (fresh call): W2 + W4 win -> streak 1.
select set_config('test.w4', public.finish_game(pg_temp.court(pg_temp.sid('s3'), 1), pg_temp.sid('w3'),
  array[pg_temp.pid(pg_temp.sid('s3'), 'W2'), pg_temp.pid(pg_temp.sid('s3'), 'W4')])::text, true);
select is(pg_temp.on_court(pg_temp.sid('s3'), 1), 'W2,W4,W1,W3', 'Game 4: W2, W4 stay; W1, W3 join');
select is((select winner_streak from public.courts where id = pg_temp.court(pg_temp.sid('s3'), 1)), 1, 'Streak 1 after a win from a fresh call');

-- Game 4: the challengers W1 + W3 win -> they stay with streak 1 (not 2).
select set_config('test.w5', public.finish_game(pg_temp.court(pg_temp.sid('s3'), 1), pg_temp.sid('w4'),
  array[pg_temp.pid(pg_temp.sid('s3'), 'W1'), pg_temp.pid(pg_temp.sid('s3'), 'W3')])::text, true);
select is(pg_temp.on_court(pg_temp.sid('s3'), 1), 'W1,W3,W5,W6', 'BR11: challengers who win stay');
select is((select winner_streak from public.courts where id = pg_temp.court(pg_temp.sid('s3'), 1)), 1,
  'BR11: beating the stayers starts a new streak at 1');
select is(pg_temp.queue(pg_temp.sid('s3')), 'W7,W8,W2,W4', 'The beaten stayers re-joined the end');

-- Fewer than 2 waiting: pause 3 of the 4 waiting. Challengers W5 + W6 win, but
-- only 1 is eligible -> all four re-join, LOSERS FIRST (D23, QA-03), and the
-- first 4 are called, so a winner sits out.
select public.pause_player(pg_temp.pid(pg_temp.sid('s3'), n)) from unnest(array['W7','W8','W2']) n;
select set_config('test.w6', public.finish_game(pg_temp.court(pg_temp.sid('s3'), 1), pg_temp.sid('w5'),
  array[pg_temp.pid(pg_temp.sid('s3'), 'W5'), pg_temp.pid(pg_temp.sid('s3'), 'W6')])::text, true);
select is(pg_temp.on_court(pg_temp.sid('s3'), 1), 'W4,W1,W3,W5',
  'D23: fewer than 2 waiting -> all four re-join losers first (W1,W3,W5,W6); the first 4 eligible are called');
select is(pg_temp.queue(pg_temp.sid('s3')), 'W6', 'D23: W6 (the last winner) sits out');
select is((select winner_streak from public.courts where id = pg_temp.court(pg_temp.sid('s3'), 1)), 0, 'Streak reset');
select ok(pg_temp.invariants_ok(pg_temp.sid('s3')), 'Invariants hold in winners stay');

-- Nobody else eligible: pause W6 (the only one waiting). The four on court are re-queued
-- (losers first, D23) and called again.
select public.pause_player(pg_temp.pid(pg_temp.sid('s3'), 'W6'));
select set_config('test.w7', public.finish_game(pg_temp.court(pg_temp.sid('s3'), 1), pg_temp.sid('w6'),
  array[pg_temp.pid(pg_temp.sid('s3'), 'W4'), pg_temp.pid(pg_temp.sid('s3'), 'W5')])::text, true);
select is(pg_temp.cur(pg_temp.sid('s3'), 1), pg_temp.sid('w7'), 'finish_game returns the next game id (here: the re-queued four)');
select is(pg_temp.on_court(pg_temp.sid('s3'), 1), 'W1,W3,W4,W5', 'Only the four re-queued are eligible, so they are called again (losers first)');
select ok(pg_temp.invariants_ok(pg_temp.sid('s3')), 'Invariants hold');

-- ===========================================================================
-- end_session (BR4): running games closed, courts freed, everyone left
-- ===========================================================================
select set_config('test.running', pg_temp.cur(pg_temp.sid('s3'), 1)::text, true);
select set_config('test.played_before', pg_temp.played(pg_temp.sid('s3'), array['W1','W3','W4','W5'])::text, true);
select lives_ok($$ select public.end_session(pg_temp.sid('s3')) $$, 'End the winners-stay session mid-game');
select ok((select ended_at is not null and winner_ids is null from public.games where id = pg_temp.sid('running')),
  'end_session: the running game is closed with no winner');
select is(pg_temp.played(pg_temp.sid('s3'), array['W1','W3','W4','W5'])::text, current_setting('test.played_before'),
  'end_session: games_played unchanged for the closed game');
select is((select count(*)::int from public.courts where session_id = pg_temp.sid('s3') and (current_game_id is not null or winner_streak <> 0)), 0,
  'end_session: every court is empty');
select is((select array_agg(distinct status)::text from public.session_players where session_id = pg_temp.sid('s3')), '{left}',
  'end_session: every player is left');
select is((select count(*)::int from public.games where session_id = pg_temp.sid('s3') and ended_at is null), 0, 'No running games remain');
select is(pg_temp.err($$ select public.call_next(pg_temp.court(pg_temp.sid('s3'), 2)) $$), 'session_not_live',
  'After ending, courts cannot call');
reset role;

select * from finish();
rollback;
