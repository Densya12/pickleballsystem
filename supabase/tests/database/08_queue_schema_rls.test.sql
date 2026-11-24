-- Phase 3 tables: constraints, privileges, RLS reads, Realtime publication.
-- Run: npm run test:db   (needs the local stack: npx supabase start)
begin;
select plan(35);

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

insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner.a@example.com'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner.b@example.com');
insert into public.clubs (id, name, created_by) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Club A', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Club B', '22222222-2222-2222-2222-222222222222');
insert into public.club_staff (club_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'owner');

-- Club A: a live session with 5 walk-ins and one running game. Club B: a live session, 4 walk-ins.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select set_config('test.sa', public.create_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Session A', now(), now() + interval '3h', 2, p_start => true)::text, true);
select public.add_walk_in(pg_temp.sid('sa'), 'A' || n, 'beginner') from generate_series(1, 5) n;
select public.call_next((select id from public.courts where session_id = pg_temp.sid('sa') and number = 1));
reset role;
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select set_config('test.sb', public.create_session('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Session B', now(), now() + interval '3h', 1, p_start => true)::text, true);
select public.add_walk_in(pg_temp.sid('sb'), 'B' || n, 'beginner') from generate_series(1, 4) n;
reset role;

-- ---------------------------------------------------------------------------
-- RLS reads: staff of the session's club only
-- ---------------------------------------------------------------------------
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is((select count(*)::int from public.session_players), 5, 'A reads their 5 players');
select is((select count(*)::int from public.courts), 2, 'A reads their 2 courts');
select is((select count(*)::int from public.games), 1, 'A reads their 1 game');
select is((select count(*)::int from public.session_players where session_id = pg_temp.sid('sb')), 0, 'A cannot read Club B players');
select is((select count(*)::int from public.courts where session_id = pg_temp.sid('sb')), 0, 'A cannot read Club B courts');
select ok(public.is_session_staff(pg_temp.sid('sa')) and not public.is_session_staff(pg_temp.sid('sb')),
  'is_session_staff answers only for the caller');

-- device_id is never readable; no direct writes on any table.
select throws_ok($$ select device_id from public.session_players $$, '42501', null, 'device_id is not readable');
select throws_ok($$ select * from public.session_players $$, '42501', null, 'select * on session_players is refused (device_id)');
select lives_ok($$ select id, session_id, member_id, display_name, level, status, queue_pos, games_played, is_walk_in, created_at from public.session_players $$,
  'Every other player column is readable');
select throws_ok($$ insert into public.session_players (session_id, display_name, level) values (pg_temp.sid('sa'), 'Direct', 'beginner') $$,
  '42501', null, 'No direct insert into session_players');
select throws_ok($$ update public.session_players set status = 'playing' $$, '42501', null, 'No direct update of session_players');
select throws_ok($$ delete from public.session_players $$, '42501', null, 'No direct delete from session_players');
select throws_ok($$ update public.courts set current_game_id = null $$, '42501', null, 'No direct update of courts');
select throws_ok($$ insert into public.courts (session_id, number, label) values (pg_temp.sid('sa'), 3, 'Court 3') $$,
  '42501', null, 'No direct insert into courts');
select throws_ok($$ update public.games set ended_at = now() $$, '42501', null, 'No direct update of games');
select throws_ok($$ delete from public.games $$, '42501', null, 'No direct delete from games');
select throws_ok($$ select nextval('public.session_players_queue_pos_seq') $$, '42501', null, 'Clients cannot use the queue sequence');
reset role;

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select is((select count(*)::int from public.session_players where session_id = pg_temp.sid('sa')), 0, 'B cannot read Club A players');
select is((select count(*)::int from public.games where session_id = pg_temp.sid('sa')), 0, 'B cannot read Club A games');
select is((select count(*)::int from public.courts where session_id = pg_temp.sid('sa')), 0, 'B cannot read Club A courts');
reset role;

set local role anon;
select throws_ok($$ select id from public.session_players $$, '42501', null, 'anon cannot read players');
select throws_ok($$ select id from public.courts $$, '42501', null, 'anon cannot read courts');
select throws_ok($$ select id from public.games $$, '42501', null, 'anon cannot read games');
reset role;

-- ---------------------------------------------------------------------------
-- Constraints (as postgres)
-- ---------------------------------------------------------------------------
create function pg_temp.player(p_name text) returns uuid language sql as $$
  select id from public.session_players where display_name = p_name;
$$;
select throws_ok(
  $$ insert into public.games (session_id, court_id, number, player_ids)
     values (pg_temp.sid('sa'), (select id from public.courts where session_id = pg_temp.sid('sa') and number = 2), 50,
             array[pg_temp.player('A1'), pg_temp.player('A2'), pg_temp.player('A3')]) $$,
  '23514', null, 'A game needs exactly 4 players');
select throws_ok(
  $$ insert into public.games (session_id, court_id, number, player_ids)
     values (pg_temp.sid('sa'), (select id from public.courts where session_id = pg_temp.sid('sa') and number = 2), 50,
             array[pg_temp.player('A1'), pg_temp.player('A1'), pg_temp.player('A2'), pg_temp.player('A3')]) $$,
  '23514', null, 'A game''s 4 players must be different');
select throws_ok(
  $$ insert into public.games (session_id, court_id, number, player_ids, winner_ids)
     values (pg_temp.sid('sa'), (select id from public.courts where session_id = pg_temp.sid('sa') and number = 2), 50,
             array[pg_temp.player('A1'), pg_temp.player('A2'), pg_temp.player('A3'), pg_temp.player('A4')],
             array[pg_temp.player('A1'), pg_temp.player('A5')]) $$,
  '23514', null, 'Winners must be 2 of the 4 players');
select throws_ok(
  $$ insert into public.games (session_id, court_id, number, player_ids)
     values (pg_temp.sid('sa'), (select id from public.courts where session_id = pg_temp.sid('sa') and number = 1), 50,
             array[pg_temp.player('A1'), pg_temp.player('A2'), pg_temp.player('A3'), pg_temp.player('A5')]) $$,
  '23505', null, 'One running game per court');
select throws_ok(
  $$ insert into public.games (session_id, court_id, number, player_ids)
     values (pg_temp.sid('sa'), (select id from public.courts where session_id = pg_temp.sid('sa') and number = 2), 1,
             array[pg_temp.player('A1'), pg_temp.player('A2'), pg_temp.player('A3'), pg_temp.player('A5')]) $$,
  '23505', null, 'Game numbers are unique per session');
select throws_ok($$ update public.courts set number = 9 where session_id = pg_temp.sid('sa') and number = 2 $$,
  '23514', null, 'Court numbers are 1..8');
select throws_ok($$ update public.session_players set status = 'waiting' where display_name = 'A5' $$,
  '23514', null, 'Unknown player status refused');
select throws_ok($$ update public.session_players set display_name = repeat('n', 41) where display_name = 'A5' $$,
  '23514', null, 'Names longer than 40 refused');

-- ---------------------------------------------------------------------------
-- Realtime and internal helpers
-- ---------------------------------------------------------------------------
select is(
  (select array_agg(tablename::text order by tablename) from pg_publication_tables
   where pubname = 'supabase_realtime' and schemaname = 'public'
     and tablename in ('sessions', 'session_players', 'courts', 'games')),
  array['courts', 'games', 'session_players', 'sessions'],
  'NF9: sessions, session_players, courts and games are in the Realtime publication');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private'
     and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))),
  0, 'No private helper (eligibility, requeue, start_game, ...) is executable by clients');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('call_next', 'finish_game', 'add_walk_in', 'pause_player', 'resume_player', 'remove_player', 'session_eligible_count')
     and has_function_privilege('anon', p.oid, 'execute')),
  0, 'anon cannot execute any queue function');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))
     and (p.prorettype in ('public.session_players'::regtype, 'public.sessions'::regtype)
          or 'device_id' = any (coalesce(p.proargnames, '{}'))
          or 'display_token' = any (coalesce(p.proargnames, '{}')))),
  0, 'No client-callable function returns device_id or display_token');

select * from finish();
rollback;
