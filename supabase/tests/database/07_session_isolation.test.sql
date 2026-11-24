-- Phase 2 sessions: cross-club isolation for every function, anonymous
-- (player) sessions refused, and signed-out callers refused.
-- Run: npm run test:db   (needs the local stack: npx supabase start)
begin;
select plan(37);

create function pg_temp.as_user(p_sub uuid, p_extra jsonb default '{}') returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    (jsonb_build_object('sub', p_sub, 'role', 'authenticated') || p_extra)::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

-- A owns Club A, B owns Club B, N has no club, P is an anonymous player.
insert into auth.users (id, instance_id, aud, role, email, is_anonymous) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner.a@example.com', false),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner.b@example.com', false),
  ('88888888-8888-8888-8888-888888888888', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'noclub.n@example.com', false),
  ('77777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true);

insert into public.clubs (id, name, created_by) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Club A', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Club B', '22222222-2222-2222-2222-222222222222');
insert into public.club_staff (club_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'owner');

-- Club A: one live session and one draft.
insert into public.sessions (id, club_id, name, starts_at, ends_at, courts_count, points_to, rotation, fee) values
  ('a0000000-0000-0000-0000-00000000000a', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A Live', now(), now() + interval '3h', 2, 11, 'all_off', 150),
  ('a0000000-0000-0000-0000-00000000000d', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A Draft', now() + interval '1 day', now() + interval '1 day 3h', 2, 11, 'all_off', 150);
update public.sessions set status = 'live', started_at = now() where id = 'a0000000-0000-0000-0000-00000000000a';

-- Snapshot of Club A's sessions, to prove refused calls changed nothing.
create temporary table club_a_before as
  select id, status, started_at, ended_at from public.sessions where club_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- ---------------------------------------------------------------------------
-- Owner of Club B against Club A: every function refused, nothing readable
-- ---------------------------------------------------------------------------
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select is((select count(*)::int from public.sessions where club_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 0,
  'B cannot read Club A sessions');
select is((select count(*)::int from public.sessions where id = 'a0000000-0000-0000-0000-00000000000a'), 0,
  'B cannot read a Club A session by id');
select throws_ok($$ select public.create_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Intruder', now(), now() + interval '1h', 1) $$,
  '42501', 'not_staff', 'B cannot create a session in Club A');
select throws_ok($$ select public.create_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Intruder', now(), now() + interval '1h', 1, p_start => true) $$,
  '42501', 'not_staff', 'B cannot create-and-start a session in Club A');
select throws_ok($$ select public.start_session('a0000000-0000-0000-0000-00000000000d') $$,
  'P0001', 'session_not_found', 'B cannot start a Club A draft');
select throws_ok($$ select public.end_session('a0000000-0000-0000-0000-00000000000a') $$,
  'P0001', 'session_not_found', 'B cannot end the Club A live session');
select throws_ok($$ select public.delete_draft_session('a0000000-0000-0000-0000-00000000000d') $$,
  'P0001', 'session_not_found', 'B cannot delete a Club A draft');
select throws_ok($$ select public.start_session('00000000-0000-0000-0000-000000000000') $$,
  'P0001', 'session_not_found', 'An unknown id gives the same error as another club''s session');
reset role;

select results_eq(
  $$ select id, status, started_at, ended_at from public.sessions where club_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' order by id $$,
  $$ select id, status, started_at, ended_at from club_a_before order by id $$,
  'Club A sessions are unchanged after B''s attempts');
select is((select count(*)::int from public.sessions where name = 'Intruder'), 0, 'B created nothing in Club A');

-- ---------------------------------------------------------------------------
-- A signed-in user with no club
-- ---------------------------------------------------------------------------
select pg_temp.as_user('88888888-8888-8888-8888-888888888888');
select is((select count(*)::int from public.sessions), 0, 'N reads no sessions');
select throws_ok($$ select public.create_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Intruder', now(), now() + interval '1h', 1) $$,
  '42501', 'not_staff', 'N cannot create a session in Club A');
select throws_ok($$ select public.create_session(null, 'Intruder', now(), now() + interval '1h', 1) $$,
  '42501', 'not_staff', 'N cannot create a session without a club');
select throws_ok($$ select public.start_session('a0000000-0000-0000-0000-00000000000d') $$,
  'P0001', 'session_not_found', 'N cannot start a Club A draft');
select throws_ok($$ select public.end_session('a0000000-0000-0000-0000-00000000000a') $$,
  'P0001', 'session_not_found', 'N cannot end the Club A live session');
select throws_ok($$ select public.delete_draft_session('a0000000-0000-0000-0000-00000000000d') $$,
  'P0001', 'session_not_found', 'N cannot delete a Club A draft');
reset role;

-- ---------------------------------------------------------------------------
-- Anonymous (player) sessions are refused, even with a staff row
-- ---------------------------------------------------------------------------
-- Phase 1 already stops anonymous users from becoming staff. Give P a staff
-- row anyway so these tests prove the session functions check on their own.
insert into public.club_staff (club_id, user_id, role)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '77777777-7777-7777-7777-777777777777', 'organizer');

select pg_temp.as_user('77777777-7777-7777-7777-777777777777', '{"is_anonymous": true}');
select throws_ok($$ select public.create_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Player made', now() + interval '2 days', now() + interval '2 days 1h', 1) $$,
  '42501', 'not_organizer_account', 'Anonymous session cannot create a session');
select throws_ok($$ select public.start_session('a0000000-0000-0000-0000-00000000000d') $$,
  '42501', 'not_organizer_account', 'Anonymous session cannot start a session');
select throws_ok($$ select public.end_session('a0000000-0000-0000-0000-00000000000a') $$,
  '42501', 'not_organizer_account', 'Anonymous session cannot end a session');
select throws_ok($$ select public.delete_draft_session('a0000000-0000-0000-0000-00000000000d') $$,
  '42501', 'not_organizer_account', 'Anonymous session cannot delete a draft');
select throws_ok($$ select public.start_session('00000000-0000-0000-0000-000000000000') $$,
  '42501', 'not_organizer_account', 'The anonymous check runs before the session lookup');
reset role;

select pg_temp.as_user('77777777-7777-7777-7777-777777777777', '{"is_anonymous": "true"}');
select throws_ok($$ select public.end_session('a0000000-0000-0000-0000-00000000000a') $$,
  '42501', 'not_organizer_account', 'is_anonymous as the string "true" is refused too');
reset role;

select results_eq(
  $$ select id, status, started_at, ended_at from public.sessions where club_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' order by id $$,
  $$ select id, status, started_at, ended_at from club_a_before order by id $$,
  'Club A sessions are unchanged after the anonymous attempts');
select is((select count(*)::int from public.sessions where name = 'Player made'), 0, 'The anonymous session created nothing');

-- Control: a real staff account (is_anonymous false) still works.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111', '{"is_anonymous": false}');
select lives_ok($$ select public.delete_draft_session('a0000000-0000-0000-0000-00000000000d') $$,
  'Control: a real owner can delete the draft');
select lives_ok($$ select public.end_session('a0000000-0000-0000-0000-00000000000a') $$,
  'Control: a real owner can end the live session');
reset role;

-- ---------------------------------------------------------------------------
-- No JWT (authenticated role without claims) and the anon role
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '', true);
set local role authenticated;
select throws_ok($$ select public.create_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'No user', now(), now() + interval '1h', 1) $$,
  '42501', 'not_authenticated', 'No JWT: create_session refused');
select throws_ok($$ select public.start_session('a0000000-0000-0000-0000-00000000000a') $$,
  '42501', 'not_authenticated', 'No JWT: start_session refused');
select throws_ok($$ select public.end_session('a0000000-0000-0000-0000-00000000000a') $$,
  '42501', 'not_authenticated', 'No JWT: end_session refused');
select throws_ok($$ select public.delete_draft_session('a0000000-0000-0000-0000-00000000000a') $$,
  '42501', 'not_authenticated', 'No JWT: delete_draft_session refused');
reset role;

set local role anon;
select throws_ok($$ select id from public.sessions $$, '42501', null, 'anon cannot read sessions');
select throws_ok($$ select public.create_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Anon', now(), now() + interval '1h', 1) $$,
  '42501', null, 'anon cannot execute create_session');
select throws_ok($$ select public.start_session('a0000000-0000-0000-0000-00000000000a') $$,
  '42501', null, 'anon cannot execute start_session');
select throws_ok($$ select public.end_session('a0000000-0000-0000-0000-00000000000a') $$,
  '42501', null, 'anon cannot execute end_session');
select throws_ok($$ select public.delete_draft_session('a0000000-0000-0000-0000-00000000000a') $$,
  '42501', null, 'anon cannot execute delete_draft_session');
reset role;

-- Function privilege table, as the API sees it.
select ok(
  not has_function_privilege('anon', 'public.create_session(uuid, text, timestamptz, timestamptz, integer, integer, text, boolean, integer, boolean, text[])', 'execute')
  and not has_function_privilege('anon', 'public.start_session(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.end_session(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.delete_draft_session(uuid)', 'execute'),
  'anon has no execute on the session-changing functions');
select ok(
  has_function_privilege('authenticated', 'public.start_session(uuid)', 'execute')
  and has_function_privilege('anon', 'public.is_checkin_open(text)', 'execute'),
  'authenticated may call start_session; anon may call is_checkin_open');

select * from finish();
rollback;
