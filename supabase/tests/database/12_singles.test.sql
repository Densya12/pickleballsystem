-- Phase 4b singles courts: formats, calls of 2, all off, winners stay (1 winner),
-- mixed sessions, set_court_format, swap on singles, constraints.
-- Run: npm run test:db   (needs the local stack: npx supabase start)
begin;
select plan(64);

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
  select id from public.session_players where session_id = p_session and display_name = p_name and status <> 'left';
$$;
create function pg_temp.court(p_session uuid, p_number int) returns uuid language sql as $$
  select id from public.courts where session_id = p_session and number = p_number;
$$;
create function pg_temp.cur(p_session uuid, p_number int) returns uuid language sql as $$
  select current_game_id from public.courts where session_id = p_session and number = p_number;
$$;
create function pg_temp.names(p_ids uuid[]) returns text language sql as $$
  select string_agg(p.display_name, ',' order by u.i)
  from unnest(p_ids) with ordinality u(id, i) join public.session_players p on p.id = u.id;
$$;
create function pg_temp.on_court(p_session uuid, p_number int) returns text language sql as $$
  select pg_temp.names(g.player_ids) from public.games g where g.id = pg_temp.cur(p_session, p_number);
$$;
create function pg_temp.queue(p_session uuid) returns text language sql as $$
  select coalesce(string_agg(display_name, ',' order by queue_pos), '')
  from public.session_players where session_id = p_session and status = 'queued';
$$;
create function pg_temp.streak(p_session uuid, p_number int) returns int language sql as $$
  select winner_streak from public.courts where session_id = p_session and number = p_number;
$$;
-- 'message', or 'message:detail' for our own P0001 errors (detail = players still needed).
create function pg_temp.err(p_sql text) returns text language plpgsql as $$
declare v_msg text; v_detail text; v_state text;
begin
  execute p_sql;
  return 'no error';
exception when others then
  get stacked diagnostics v_msg = message_text, v_detail = pg_exception_detail, v_state = returned_sqlstate;
  return v_msg || case when v_state = 'P0001' then coalesce(':' || nullif(v_detail, ''), '') else '' end;
end;
$$;
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
      where c.session_id = p_session and c.current_game_id is distinct from g.id)
    and not exists (
      select 1 from public.games g join public.courts c on c.id = g.court_id
      where g.session_id = p_session and g.ended_at is null and g.format <> c.format);
$$;

insert into auth.users (id, instance_id, aud, role, email, is_anonymous) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.com', false),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@example.com', false),
  ('77777777-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true);
insert into public.clubs (id, name, created_by, default_rotation) values
  ('c1000000-0000-0000-0000-000000000000', 'Singles All Off', '11111111-1111-1111-1111-111111111111', 'all_off'),
  ('c2000000-0000-0000-0000-000000000000', 'Singles Winners', '11111111-1111-1111-1111-111111111111', 'winners_stay'),
  ('c3000000-0000-0000-0000-000000000000', 'Mixed Club', '11111111-1111-1111-1111-111111111111', 'all_off'),
  ('c4000000-0000-0000-0000-000000000000', 'Swap Club', '11111111-1111-1111-1111-111111111111', 'all_off'),
  ('cb000000-0000-0000-0000-000000000000', 'Other Club', '22222222-2222-2222-2222-222222222222', 'all_off');
insert into public.club_staff (club_id, user_id, role)
select c, '11111111-1111-1111-1111-111111111111', 'owner'
from unnest(array['c1000000-0000-0000-0000-000000000000', 'c2000000-0000-0000-0000-000000000000',
                  'c3000000-0000-0000-0000-000000000000', 'c4000000-0000-0000-0000-000000000000']::uuid[]) c;
insert into public.club_staff (club_id, user_id, role) values
  ('cb000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'owner');

-- ===========================================================================
-- Formats on sessions and courts
-- ===========================================================================
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select set_config('test.draft', public.create_session('c3000000-0000-0000-0000-000000000000', 'Plain Draft', now() + interval '1 day', now() + interval '1 day 2h', 3)::text, true);
select is((select court_formats from public.sessions where id = pg_temp.sid('draft')), array['doubles', 'doubles', 'doubles'],
  'No formats given: every court is doubles');
select is(pg_temp.err($$ select public.create_session('c3000000-0000-0000-0000-000000000000', 'Bad', now(), now() + interval '1h', 2, p_court_formats => array['singles']) $$),
  'new row for relation "sessions" violates check constraint "sessions_court_formats_valid"', 'One format per court is required');
select is(pg_temp.err($$ select public.create_session('c3000000-0000-0000-0000-000000000000', 'Bad', now(), now() + interval '1h', 1, p_court_formats => array['triples']) $$),
  'new row for relation "sessions" violates check constraint "sessions_court_formats_valid"', 'Only doubles or singles');
select is(pg_temp.err($$ select public.create_session('c3000000-0000-0000-0000-000000000000', 'Bad', now(), now() + interval '1h', 2, p_court_formats => array['singles', null]) $$),
  'new row for relation "sessions" violates check constraint "sessions_court_formats_valid"', 'No missing entries');

select set_config('test.s1', public.create_session('c1000000-0000-0000-0000-000000000000', 'Singles Night', now(), now() + interval '3h', 1,
  p_court_formats => array['singles'], p_start => true)::text, true);
select set_config('test.s3', public.create_session('c3000000-0000-0000-0000-000000000000', 'Mixed Night', now(), now() + interval '3h', 2,
  p_court_formats => array['doubles', 'singles'], p_start => true)::text, true);
select results_eq($$ select number, format from public.courts where session_id = pg_temp.sid('s3') order by number $$,
  $$ values (1, 'doubles'::text), (2, 'singles'::text) $$, 'Going live creates each court with its planned format');
select is((select format from public.courts where session_id = pg_temp.sid('s1')), 'singles', 'A singles-only session');
reset role;

-- ===========================================================================
-- Singles call and all off
-- ===========================================================================
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.add_walk_in(pg_temp.sid('s1'), 'X1', 'beginner');
select is(pg_temp.err($$ select public.call_next(pg_temp.court(pg_temp.sid('s1'), 1)) $$), 'not_enough_players:1',
  'Singles with 1 eligible: 1 more needed');
select public.add_walk_in(pg_temp.sid('s1'), 'X' || n, 'beginner') from generate_series(2, 5) n;
select set_config('test.x_g1', public.call_next(pg_temp.court(pg_temp.sid('s1'), 1))::text, true);
select is(pg_temp.on_court(pg_temp.sid('s1'), 1), 'X1,X2', 'Singles calls the first 2');
select is((select format from public.games where id = pg_temp.sid('x_g1')), 'singles', 'The game is recorded as singles');
select is(pg_temp.queue(pg_temp.sid('s1')), 'X3,X4,X5', 'The rest keep waiting');
select is(public.session_eligible_count(pg_temp.sid('s1')), 3, 'Eligibility is unchanged (BR6)');
select is(pg_temp.err($$ select public.finish_game(pg_temp.court(pg_temp.sid('s1'), 1), pg_temp.sid('x_g1'), array[pg_temp.pid(pg_temp.sid('s1'), 'X1'), pg_temp.pid(pg_temp.sid('s1'), 'X2')]) $$),
  'invalid_winners', 'Singles has 1 winner, not 2');
select set_config('test.x_g2', public.finish_game(pg_temp.court(pg_temp.sid('s1'), 1), pg_temp.sid('x_g1'))::text, true);
select is(pg_temp.on_court(pg_temp.sid('s1'), 1), 'X3,X4', 'All off (singles): both re-join, the next 2 are called');
select is(pg_temp.queue(pg_temp.sid('s1')), 'X5,X1,X2', 'Both re-joined the end in call order');
select is((select array_agg(games_played order by display_name) from public.session_players where session_id = pg_temp.sid('s1')),
  array[1, 1, 0, 0, 0], 'BR12: +1 game for the 2 who played');
select ok(pg_temp.invariants_ok(pg_temp.sid('s1')), 'Invariants hold');
reset role;

-- ===========================================================================
-- Winners stay, singles
-- ===========================================================================
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select set_config('test.s2', public.create_session('c2000000-0000-0000-0000-000000000000', 'Singles Winners Night', now(), now() + interval '3h', 1,
  p_court_formats => array['singles'], p_start => true)::text, true);
select public.add_walk_in(pg_temp.sid('s2'), 'Y' || n, 'advanced') from generate_series(1, 5) n;
select set_config('test.y1', public.call_next(pg_temp.court(pg_temp.sid('s2'), 1))::text, true);
select is(pg_temp.on_court(pg_temp.sid('s2'), 1), 'Y1,Y2', 'Game 1: Y1 vs Y2');
select is(pg_temp.err($$ select public.finish_game(pg_temp.court(pg_temp.sid('s2'), 1), pg_temp.sid('y1')) $$), 'invalid_winners',
  'Winners stay: the winner is required');
select is(pg_temp.err($$ select public.finish_game(pg_temp.court(pg_temp.sid('s2'), 1), pg_temp.sid('y1'), array[pg_temp.pid(pg_temp.sid('s2'), 'Y1'), pg_temp.pid(pg_temp.sid('s2'), 'Y2')]) $$),
  'invalid_winners', 'Winners stay singles: exactly 1 winner');
select is(pg_temp.err($$ select public.finish_game(pg_temp.court(pg_temp.sid('s2'), 1), pg_temp.sid('y1'), array[pg_temp.pid(pg_temp.sid('s2'), 'Y3')]) $$),
  'invalid_winners', 'The winner must have played');

select set_config('test.y2', public.finish_game(pg_temp.court(pg_temp.sid('s2'), 1), pg_temp.sid('y1'), array[pg_temp.pid(pg_temp.sid('s2'), 'Y2')])::text, true);
select is((select pg_temp.names(winner_ids) from public.games where id = pg_temp.sid('y1')), 'Y2', 'The 1 winner is saved');
select is(pg_temp.on_court(pg_temp.sid('s2'), 1), 'Y2,Y3', 'The winner stays (listed first); the first waiting joins');
select is(pg_temp.queue(pg_temp.sid('s2')), 'Y4,Y5,Y1', 'The loser re-joined the end');
select is(pg_temp.streak(pg_temp.sid('s2'), 1), 1, 'Streak 1');

select set_config('test.y3', public.finish_game(pg_temp.court(pg_temp.sid('s2'), 1), pg_temp.sid('y2'), array[pg_temp.pid(pg_temp.sid('s2'), 'Y2')])::text, true);
select is(pg_temp.on_court(pg_temp.sid('s2'), 1), 'Y4,Y5', 'Second win in a row: both go off, the next 2 are called');
select is(pg_temp.queue(pg_temp.sid('s2')), 'Y1,Y2,Y3', 'Winner first, then loser, at the end');
select is(pg_temp.streak(pg_temp.sid('s2'), 1), 0, 'Streak reset');

select set_config('test.y4', public.finish_game(pg_temp.court(pg_temp.sid('s2'), 1), pg_temp.sid('y3'), array[pg_temp.pid(pg_temp.sid('s2'), 'Y5')])::text, true);
select is(pg_temp.on_court(pg_temp.sid('s2'), 1), 'Y5,Y1', 'A fresh winner stays; the first waiting joins');
select set_config('test.y5', public.finish_game(pg_temp.court(pg_temp.sid('s2'), 1), pg_temp.sid('y4'), array[pg_temp.pid(pg_temp.sid('s2'), 'Y1')])::text, true);
select is(pg_temp.on_court(pg_temp.sid('s2'), 1), 'Y1,Y2', 'The challenger who wins stays');
select is(pg_temp.streak(pg_temp.sid('s2'), 1), 1, 'Beating the stayer starts a new streak at 1');

-- Fewer than 1 waiting: pause everyone waiting. Y2 (challenger) wins -> both re-join, winner first; the normal call runs.
select public.pause_player(pg_temp.pid(pg_temp.sid('s2'), n)) from unnest(array['Y3', 'Y4', 'Y5']) n;
select set_config('test.y6', public.finish_game(pg_temp.court(pg_temp.sid('s2'), 1), pg_temp.sid('y5'), array[pg_temp.pid(pg_temp.sid('s2'), 'Y2')])::text, true);
select is(pg_temp.on_court(pg_temp.sid('s2'), 1), 'Y2,Y1',
  'Fewer than 1 waiting: both re-join winner first and the normal call takes them');
select is(pg_temp.streak(pg_temp.sid('s2'), 1), 0, 'Streak reset');
select ok(pg_temp.invariants_ok(pg_temp.sid('s2')), 'Invariants hold');
reset role;

-- ===========================================================================
-- Mixed session: 1 doubles + 1 singles court
-- ===========================================================================
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.add_walk_in(pg_temp.sid('s3'), 'M' || n, 'intermediate') from generate_series(1, 7) n;
select set_config('test.m1', public.call_next(pg_temp.court(pg_temp.sid('s3'), 1))::text, true);
select set_config('test.m2', public.call_next(pg_temp.court(pg_temp.sid('s3'), 2))::text, true);
select is(pg_temp.on_court(pg_temp.sid('s3'), 1), 'M1,M2,M3,M4', 'Doubles court: 4');
select is(pg_temp.on_court(pg_temp.sid('s3'), 2), 'M5,M6', 'Singles court: the next 2');
select ok(pg_temp.invariants_ok(pg_temp.sid('s3')), 'Nobody on two courts');
select set_config('test.m3', public.finish_game(pg_temp.court(pg_temp.sid('s3'), 2), pg_temp.sid('m2'))::text, true);
select is(pg_temp.on_court(pg_temp.sid('s3'), 2), 'M7,M5', 'Singles rotates within the shared queue');
select set_config('test.m4', public.finish_game(pg_temp.court(pg_temp.sid('s3'), 1), pg_temp.sid('m1'))::text, true);
select is(pg_temp.on_court(pg_temp.sid('s3'), 1), 'M6,M1,M2,M3', 'Doubles rotates within the same queue');
select ok(pg_temp.invariants_ok(pg_temp.sid('s3')), 'Still nobody on two courts, formats match');
select is((select count(*)::int from public.session_players where session_id = pg_temp.sid('s3') and status = 'playing'), 6, '6 playing on 2 courts');

-- ===========================================================================
-- set_court_format
-- ===========================================================================
select is(pg_temp.err($$ select public.set_court_format(pg_temp.court(pg_temp.sid('s3'), 1), 'singles') $$), 'court_busy',
  'Refused while a game runs');
select public.finish_game(pg_temp.court(pg_temp.sid('s1'), 1), pg_temp.sid('x_g2'));
reset role;

-- An empty court: the draft-only club (Swap Club) goes live with 2 courts, nobody waiting.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select set_config('test.s4', public.create_session('c4000000-0000-0000-0000-000000000000', 'Swap Night', now(), now() + interval '3h', 2, p_start => true)::text, true);
select lives_ok($$ select public.set_court_format(pg_temp.court(pg_temp.sid('s4'), 2), 'singles') $$, 'An empty court becomes singles');
select results_eq($$ select format, winner_streak from public.courts where id = pg_temp.court(pg_temp.sid('s4'), 2) $$,
  $$ values ('singles'::text, 0) $$, 'Court 2 is singles');
select is((select court_formats from public.sessions where id = pg_temp.sid('s4')), array['doubles', 'singles'], 'The session plan follows');
select is(pg_temp.err($$ select public.set_court_format(pg_temp.court(pg_temp.sid('s4'), 2), 'triples') $$), 'invalid_format', 'Unknown format refused');
select is(pg_temp.err($$ select public.set_court_format(pg_temp.court(pg_temp.sid('s4'), 2), null) $$), 'invalid_format', 'Missing format refused');
reset role;

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select is(pg_temp.err($$ select public.set_court_format(pg_temp.court(pg_temp.sid('s4'), 1), 'singles') $$), 'court_not_found',
  'Another club''s staff cannot change a court');
reset role;
select pg_temp.as_user('77777777-0000-0000-0000-000000000001', '{"is_anonymous": true}');
select is(pg_temp.err($$ select public.set_court_format(pg_temp.court(pg_temp.sid('s4'), 1), 'singles') $$), 'not_organizer_account',
  'Anonymous callers cannot change a court');
reset role;
set local role anon;
select throws_ok($$ select public.set_court_format(pg_temp.court(pg_temp.sid('s4'), 1), 'singles') $$, '42501', null, 'anon role cannot call it');
reset role;
select is((select format from public.courts where id = pg_temp.court(pg_temp.sid('s4'), 1)), 'doubles', 'Court 1 unchanged');

-- ===========================================================================
-- BR19 swap on a singles court (anonymous player)
-- ===========================================================================
select set_config('test.code4', (select join_code from public.sessions where id = pg_temp.sid('s4')), true);
select pg_temp.as_user('77777777-0000-0000-0000-000000000001', '{"is_anonymous": true}');
select set_config('test.p', public.join_session(current_setting('test.code4'), 'Phone Pia')::text, true);
reset role;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.add_walk_in(pg_temp.sid('s4'), 'Z' || n, 'beginner') from generate_series(1, 2) n;
select set_config('test.zg', public.call_next(pg_temp.court(pg_temp.sid('s4'), 2))::text, true);
select is(pg_temp.on_court(pg_temp.sid('s4'), 2), 'Phone Pia,Z1', 'The phone player is called to the singles court');
reset role;
select pg_temp.as_user('77777777-0000-0000-0000-000000000001', '{"is_anonymous": true}');
select public.player_not_ready(pg_temp.sid('p'));
reset role;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(public.swap_not_ready(pg_temp.court(pg_temp.sid('s4'), 2), pg_temp.sid('p')), pg_temp.pid(pg_temp.sid('s4'), 'Z2'), 'Swap on singles brings in Z2');
reset role;
select is(pg_temp.on_court(pg_temp.sid('s4'), 2), 'Z2,Z1', 'Z2 takes Phone Pia''s place');
select is((select status from public.session_players where id = pg_temp.sid('p')), 'queued', 'Phone Pia is queued again');
select is(pg_temp.queue(pg_temp.sid('s4')), 'Phone Pia', 'At the front');
select ok(pg_temp.invariants_ok(pg_temp.sid('s4')), 'Invariants hold after the swap');
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(pg_temp.err($$ select public.set_court_format(pg_temp.court(pg_temp.sid('s4'), 2), 'doubles') $$), 'court_busy', 'Still busy after a swap');
select public.end_session(pg_temp.sid('s4'));
select is(pg_temp.err($$ select public.set_court_format(pg_temp.court(pg_temp.sid('s4'), 1), 'singles') $$), 'session_not_live', 'Ended session refused');
reset role;

-- ===========================================================================
-- Constraints on games (as postgres)
-- ===========================================================================
create function pg_temp.try_game(p_format text, p_players text[], p_winners text[]) returns void language sql as $$
  insert into public.games (session_id, court_id, number, format, player_ids, winner_ids)
  values (pg_temp.sid('s3'), pg_temp.court(pg_temp.sid('s3'), 2), 900 + cardinality(p_players) * 10 + coalesce(cardinality(p_winners), 0), p_format,
          array(select pg_temp.pid(pg_temp.sid('s3'), n) from unnest(p_players) n),
          case when p_winners is null then null else array(select pg_temp.pid(pg_temp.sid('s3'), n) from unnest(p_winners) n) end);
$$;
-- Free Court 2 of the mixed session first (one running game per court).
update public.games set ended_at = now() where id = pg_temp.cur(pg_temp.sid('s3'), 2);
update public.courts set current_game_id = null where id = pg_temp.court(pg_temp.sid('s3'), 2);
select throws_ok($$ select pg_temp.try_game('singles', array['M1','M2','M3','M4'], null) $$, '23514', null, 'Singles with 4 players is refused');
select throws_ok($$ select pg_temp.try_game('doubles', array['M1','M2'], null) $$, '23514', null, 'Doubles with 2 players is refused');
select throws_ok($$ select pg_temp.try_game('singles', array['M1','M2'], array['M1','M2']) $$, '23514', null, 'Singles with 2 winners is refused');
select throws_ok($$ select pg_temp.try_game('doubles', array['M1','M2','M3','M4'], array['M1']) $$, '23514', null, 'Doubles with 1 winner is refused');
select lives_ok($$ select pg_temp.try_game('singles', array['M1','M2'], array['M2']) $$, 'Singles with 2 players and 1 winner is allowed');
select throws_ok($$ update public.courts set format = 'triples' where id = pg_temp.court(pg_temp.sid('s3'), 1) $$, '23514', null, 'Court format must be doubles or singles');

select * from finish();
rollback;
