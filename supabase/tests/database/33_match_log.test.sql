-- Phase 9.2a / D27: Match log corrections (public.correct_game) and Standings
-- (public.session_standings).
-- Run: npm run test:db   (needs the local stack: npx supabase start)
begin;
select plan(39);

create function pg_temp.as_user(p_sub uuid, p_extra jsonb default '{}') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', (jsonb_build_object('sub', p_sub, 'role', 'authenticated') || p_extra)::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;
create function pg_temp.as_owner() returns void language sql as $$ select pg_temp.as_user('11111111-1111-1111-1111-111111111111') $$;
create function pg_temp.err(p_sql text) returns text language plpgsql as $$
declare v_msg text; v_state text;
begin
  execute p_sql;
  return 'no error';
exception when others then
  get stacked diagnostics v_msg = message_text, v_state = returned_sqlstate;
  return case when v_state = 'P0001' then v_msg else v_state || ' ' || v_msg end;
end;
$$;
create function pg_temp.sid() returns uuid language sql as $$ select current_setting('test.s')::uuid $$;
create function pg_temp.p(p_name text) returns uuid language sql as $$
  select id from public.session_players where session_id = pg_temp.sid() and display_name = 'P ' || p_name;
$$;
create function pg_temp.ps(p_names text[]) returns uuid[] language sql as $$ select array(select pg_temp.p(n) from unnest(p_names) with ordinality u(n, i) order by i) $$;
create function pg_temp.court(p_n integer) returns uuid language sql as $$ select id from public.courts where session_id = pg_temp.sid() and number = p_n $$;
create function pg_temp.game(p_number integer) returns uuid language sql as $$ select id from public.games where session_id = pg_temp.sid() and number = p_number $$;
create function pg_temp.names(p_ids uuid[]) returns text language sql as $$
  select string_agg(substr(p.display_name, 3), ',' order by u.i) from unnest(p_ids) with ordinality u(id, i) join public.session_players p on p.id = u.id;
$$;
create function pg_temp.table_text() returns text language sql as $$
  select string_agg(format('%s:%s-%s/%s#%s', substr(display_name, 3), wins, losses, games, rank), ' ') from public.session_standings(pg_temp.sid());
$$;
-- Everything a correction must not touch.
create function pg_temp.state() returns text language sql as $$
  select md5(coalesce((select string_agg(format('%s|%s|%s|%s', c.id, c.current_game_id, c.winner_streak, c.staying_ids), ';' order by c.number)
                       from public.courts c where c.session_id = pg_temp.sid()), '')
          || coalesce((select string_agg(format('%s|%s|%s|%s|%s', p.id, p.status, p.queue_pos, p.games_played, p.skip_count), ';' order by p.id)
                       from public.session_players p where p.session_id = pg_temp.sid()), '')
          || coalesce((select string_agg(format('%s|%s|%s', g.id, g.stayed_ids, g.ended_at), ';' order by g.number)
                       from public.games g where g.session_id = pg_temp.sid()), ''));
$$;

insert into auth.users (id, instance_id, aud, role, email, is_anonymous) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.com', false),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@example.com', false),
  ('77777777-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true),
  ('77777777-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true);
insert into public.clubs (id, name, created_by) values
  ('cc000000-0000-0000-0000-000000000000', 'Log Club', '11111111-1111-1111-1111-111111111111'),
  ('cd000000-0000-0000-0000-000000000000', 'Other Club', '22222222-2222-2222-2222-222222222222');
insert into public.club_staff (club_id, user_id, role) values
  ('cc000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('cd000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'owner');

-- A live session: court 1 doubles, court 2 singles; Fair line; the court waits after Done.
select pg_temp.as_owner();
select set_config('test.s', public.create_session('cc000000-0000-0000-0000-000000000000', 'Log Night', now(), now() + interval '3h',
  2, 11, 'all_off', false, 0, true, array['doubles', 'singles'])::text, true);
select public.set_session_matchmaking(pg_temp.sid(), 'fair_line');
select public.set_session_call_mode(pg_temp.sid(), 'wait');
select public.add_walk_in(pg_temp.sid(), 'P ' || n, 'unsure') from unnest(array['A', 'B', 'C', 'D', 'E', 'F']) n;
-- E is the anonymous player's own row (checked in from a phone).
reset role;
update public.session_players set user_id = '77777777-0000-0000-0000-000000000001' where id = pg_temp.p('E');
select pg_temp.as_owner();

select has_function('public', 'correct_game', array['uuid', 'uuid[]', 'uuid[]'], 'correct_game(game, players, winners) exists');
select has_function('public', 'session_standings', array['uuid'], 'session_standings(session) exists');

-- Game 1 (doubles): A+B beat C+D. Game 2: E+F vs A+B, no result. Game 3 (singles): D beats C.
select public.call_next(pg_temp.court(1));
select public.finish_game(pg_temp.court(1), pg_temp.game(1), pg_temp.ps(array['A', 'B']));
select public.call_next(pg_temp.court(1));
select public.finish_game(pg_temp.court(1), pg_temp.game(2), null);
select public.call_next(pg_temp.court(2));
select public.finish_game(pg_temp.court(2), pg_temp.game(3), pg_temp.ps(array['D']));
select is(pg_temp.names((select player_ids from public.games where id = pg_temp.game(1))) || ' / ' || pg_temp.names((select player_ids from public.games where id = pg_temp.game(2)))
          || ' / ' || pg_temp.names((select player_ids from public.games where id = pg_temp.game(3))),
  'A,B,C,D / E,F,A,B / C,D', 'Setup: the three finished games');

-- ---------------------------------------------------------------------------
-- Standings
-- ---------------------------------------------------------------------------
select is(pg_temp.table_text(), 'A:1-0/2#1 B:1-0/2#1 D:1-1/2#3 E:0-0/1#4 F:0-0/1#4 C:0-2/2#6',
  'Wins first, then fewer losses, then name; ties share a rank; a no-result game counts in games only');

-- A running game isn't in the standings (or correctable).
select public.call_next(pg_temp.court(1));
select is((select count(*)::int from public.games where session_id = pg_temp.sid() and ended_at is null), 1, 'Setup: game 4 is running');
select is(pg_temp.table_text(), 'A:1-0/2#1 B:1-0/2#1 D:1-1/2#3 E:0-0/1#4 F:0-0/1#4 C:0-2/2#6', 'The running game doesn''t count');
select is(pg_temp.err(format('select public.correct_game(%L, %L, null)', pg_temp.game(4), (select player_ids from public.games where id = pg_temp.game(4)))),
  'game_not_finished', 'A running game can''t be corrected');

-- Who can read the standings.
select pg_temp.as_user('77777777-0000-0000-0000-000000000001', '{"is_anonymous": true}');
select is((select count(*)::int from public.session_standings(pg_temp.sid())), 6, 'A player of the session reads the standings');
select is(pg_temp.err(format('select public.correct_game(%L, %L, null)', pg_temp.game(1), (select player_ids from public.games where id = pg_temp.game(1)))),
  '42501 not_organizer_account', 'A player can''t correct a game');
select pg_temp.as_user('77777777-0000-0000-0000-000000000002', '{"is_anonymous": true}');
select is(pg_temp.err(format('select * from public.session_standings(%L)', pg_temp.sid())), 'session_not_found', 'Someone not in the session can''t');
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select is(pg_temp.err(format('select * from public.session_standings(%L)', pg_temp.sid())), 'session_not_found', 'Another club''s organizer can''t read them');
select is(pg_temp.err(format('select public.correct_game(%L, %L, null)', pg_temp.game(1), (select player_ids from public.games where id = pg_temp.game(1)))),
  'game_not_found', 'Another club''s organizer can''t correct a game');
select pg_temp.as_owner();

-- ---------------------------------------------------------------------------
-- correct_game: the rules
-- ---------------------------------------------------------------------------
select is(pg_temp.err(format('select public.correct_game(%L, %L, null)', gen_random_uuid(), pg_temp.ps(array['A', 'B', 'C', 'D']))), 'game_not_found', 'Unknown game');
select is(pg_temp.err(format('select public.correct_game(%L, %L, null)', pg_temp.game(1), pg_temp.ps(array['A', 'B', 'C', 'E']))), 'invalid_players', 'Nobody added or removed (E for D)');
select is(pg_temp.err(format('select public.correct_game(%L, %L, null)', pg_temp.game(1), pg_temp.ps(array['A', 'B', 'C', 'C']))), 'invalid_players', 'No player twice');
select is(pg_temp.err(format('select public.correct_game(%L, %L, null)', pg_temp.game(1), pg_temp.ps(array['A', 'B', 'C']))), 'invalid_players', 'All four players');
select is(pg_temp.err(format('select public.correct_game(%L, %L, null)', pg_temp.game(1), null)), 'invalid_players', 'Players are required');
select is(pg_temp.err(format('select public.correct_game(%L, %L, %L)', pg_temp.game(1), pg_temp.ps(array['A', 'B', 'C', 'D']), pg_temp.ps(array['A', 'C']))),
  'invalid_winners', 'Winners must be one full side (not one from each)');
select is(pg_temp.err(format('select public.correct_game(%L, %L, %L)', pg_temp.game(1), pg_temp.ps(array['A', 'B', 'C', 'D']), pg_temp.ps(array['A']))),
  'invalid_winners', 'Doubles: both winners');
select is(pg_temp.err(format('select public.correct_game(%L, %L, %L)', pg_temp.game(1), pg_temp.ps(array['A', 'B', 'C', 'D']), pg_temp.ps(array['E', 'F']))),
  'invalid_winners', 'Winners must be in the game');
select is(pg_temp.err(format('select public.correct_game(%L, %L, %L)', pg_temp.game(3), pg_temp.ps(array['C', 'D']), pg_temp.ps(array['C', 'D']))),
  'invalid_winners', 'Singles: one winner');

-- ---------------------------------------------------------------------------
-- A correction: the record only
-- ---------------------------------------------------------------------------
create temporary table before_state as select pg_temp.state() as h;
grant select on before_state to authenticated;
-- Game 1 was really A+C vs B+D, and B+D won.
select lives_ok(format('select public.correct_game(%L, %L, %L)', pg_temp.game(1), pg_temp.ps(array['A', 'C', 'B', 'D']), pg_temp.ps(array['D', 'B'])),
  'Fix teams and result: A+C vs B+D, right side won');
select is((select pg_temp.names(player_ids) || ' won by ' || pg_temp.names(winner_ids) from public.games where id = pg_temp.game(1)),
  'A,C,B,D won by B,D', 'The teams are stored in their new order; the winners in position order');
select is(pg_temp.state(), (select h from before_state), 'Courts, the queue, games played, streaks and stayed players are unchanged');
select is(pg_temp.table_text(), 'D:2-0/2#1 B:1-0/2#2 E:0-0/1#3 F:0-0/1#3 A:0-1/2#5 C:0-2/2#6',
  'The standings follow the correction');
select is((select payload - 'game_id' from public.events where session_id = pg_temp.sid() and type = 'game_corrected'),
  jsonb_build_object('number', 1,
    'before', jsonb_build_object('player_ids', to_jsonb(pg_temp.ps(array['A', 'B', 'C', 'D'])), 'winner_ids', to_jsonb(pg_temp.ps(array['A', 'B']))),
    'after', jsonb_build_object('player_ids', to_jsonb(pg_temp.ps(array['A', 'C', 'B', 'D'])), 'winner_ids', to_jsonb(pg_temp.ps(array['B', 'D'])))),
  'Logged: the game, before and after');
select is((select actor from public.events where session_id = pg_temp.sid() and type = 'game_corrected'),
  '11111111-1111-1111-1111-111111111111'::uuid, 'Logged with who did it (BR16)');

-- The same correction again: nothing changes, nothing is logged.
select public.correct_game(pg_temp.game(1), pg_temp.ps(array['A', 'C', 'B', 'D']), pg_temp.ps(array['B', 'D']));
select is((select count(*)::int from public.events where session_id = pg_temp.sid() and type = 'game_corrected'), 1, 'Sending the same correction twice logs it once');

-- Corrections can be corrected again: no result.
select public.correct_game(pg_temp.game(1), pg_temp.ps(array['A', 'C', 'B', 'D']), null);
select is((select winner_ids from public.games where id = pg_temp.game(1)), null, 'A result can be cleared (No result)');
select is((select count(*)::int from public.events where session_id = pg_temp.sid() and type = 'game_corrected'), 2, 'Each change is logged');

-- Singles: the other side won.
select public.correct_game(pg_temp.game(3), pg_temp.ps(array['C', 'D']), pg_temp.ps(array['C']));
select is(pg_temp.names((select winner_ids from public.games where id = pg_temp.game(3))), 'C', 'Singles: the result flips');

-- A pending Undo of an older action is no longer offered.
select public.finish_game(pg_temp.court(1), pg_temp.game(4), null);
select public.correct_game(pg_temp.game(2), pg_temp.ps(array['E', 'F', 'A', 'B']), pg_temp.ps(array['E', 'F']));
select is(pg_temp.err(format('select public.undo_last(%L)', pg_temp.sid())), 'undo_not_available', 'After a correction, Undo of the Done before it is gone');

-- ---------------------------------------------------------------------------
-- Players who left still appear; draft and ended sessions
-- ---------------------------------------------------------------------------
select public.remove_player(pg_temp.p('C'));
select is((select status from public.session_players where id = pg_temp.p('C')), 'left', 'Setup: C left');
select ok((select count(*) = 1 from public.session_standings(pg_temp.sid()) where display_name = 'P C'), 'A player who left still appears');

select public.end_session(pg_temp.sid());
select lives_ok(format('select public.correct_game(%L, %L, %L)', pg_temp.game(3), pg_temp.ps(array['C', 'D']), pg_temp.ps(array['D'])),
  'An ended session''s games can be corrected');
select pg_temp.as_user('77777777-0000-0000-0000-000000000001', '{"is_anonymous": true}');
select ok((select count(*) > 0 from public.session_standings(pg_temp.sid())), 'Players still read the standings after the session ends');
select pg_temp.as_owner();

-- No game can exist in a draft session; force one (status transitions are guarded by a trigger).
reset role;
set local session_replication_role = replica;
create temporary table saved_times as select started_at, ended_at from public.sessions where id = pg_temp.sid();
update public.sessions set status = 'draft', started_at = null, ended_at = null where id = pg_temp.sid();
set local session_replication_role = origin;
select pg_temp.as_owner();
select is(pg_temp.err(format('select public.correct_game(%L, %L, null)', pg_temp.game(3), pg_temp.ps(array['C', 'D']))),
  'session_not_started', 'Not in a draft session');
reset role;
set local session_replication_role = replica;
update public.sessions set status = 'ended', started_at = (select started_at from saved_times), ended_at = (select ended_at from saved_times) where id = pg_temp.sid();
set local session_replication_role = origin;

-- Old games without a result are "No result"; a session without games has empty standings.
select pg_temp.as_owner();
select set_config('test.s', public.create_session('cc000000-0000-0000-0000-000000000000', 'Empty Night', now(), now() + interval '3h', 1)::text, true);
select is((select count(*)::int from public.session_standings(pg_temp.sid())), 0, 'No finished games: no rows');
select is((select count(*)::int from public.events where type = 'game_corrected' and session_id = pg_temp.sid()), 0, 'Nothing logged there');

select * from finish();
rollback;
