-- Phase 2 sessions through the RPCs: defaults (BR2), GCash snapshot, every
-- transition (BR1/BR4), delete, and is_checkin_open.
-- Run: npm run test:db   (needs the local stack: npx supabase start)
begin;
select plan(51);

create function pg_temp.as_user(p_sub uuid, p_extra jsonb default '{}') returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    (jsonb_build_object('sub', p_sub, 'role', 'authenticated') || p_extra)::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

-- Shorthand for a session row's field, read as postgres.
create function pg_temp.s(p_key text) returns uuid language sql as $$
  select current_setting('test.' || p_key)::uuid;
$$;

-- A owns Club A (custom defaults + GCash), C organizes Club A, B owns Club B.
insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner.a@example.com'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner.b@example.com'),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'organizer.c@example.com');

insert into public.clubs (id, name, created_by, default_fee, default_points, default_rotation, gcash_name, gcash_number) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Club A', '11111111-1111-1111-1111-111111111111', 200, 15, 'winners_stay', 'Juan Dela Cruz', '0917-123 4567'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Club B', '22222222-2222-2222-2222-222222222222', 150, 11, 'all_off', null, null);
insert into public.club_staff (club_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'organizer'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'owner');

-- ---------------------------------------------------------------------------
-- create_session: club defaults (BR2) and GCash snapshot
-- ---------------------------------------------------------------------------
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select set_config('test.d1', public.create_session(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '  Friday Open Play  ', '2026-11-27 18:00+08', '2026-11-27 21:00+08', 3)::text, true);
select set_config('test.d2', public.create_session(
  p_club_id => 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', p_name => 'Saturday Smash',
  p_starts_at => '2026-11-28 08:00+08', p_ends_at => '2026-11-28 11:00+08', p_courts_count => 8,
  p_points_to => 21, p_rotation => 'all_off', p_pay_first => true, p_fee => 0)::text, true);
reset role;

select results_eq(
  $$ select name, status, courts_count, points_to, rotation, pay_first, fee, started_at, ended_at, created_by
     from public.sessions where id = pg_temp.s('d1') $$,
  $$ values ('Friday Open Play'::text, 'draft'::text, 3, 15, 'winners_stay'::text, false, 200,
             null::timestamptz, null::timestamptz, '33333333-3333-3333-3333-333333333333'::uuid) $$,
  'Organizer creates a draft; points, rotation and fee come from the club defaults; name is trimmed');
select results_eq(
  $$ select starts_at, ends_at from public.sessions where id = pg_temp.s('d1') $$,
  $$ values ('2026-11-27 10:00+00'::timestamptz, '2026-11-27 13:00+00'::timestamptz) $$,
  'starts_at and ends_at are stored as given');
select results_eq(
  $$ select courts_count, points_to, rotation, pay_first, fee from public.sessions where id = pg_temp.s('d2') $$,
  $$ values (8, 21, 'all_off'::text, true, 0) $$,
  'Explicit values override the club defaults');
select results_eq(
  $$ select gcash_name, gcash_number from public.sessions where id in (pg_temp.s('d1'), pg_temp.s('d2')) $$,
  $$ values ('Juan Dela Cruz'::text, '09171234567'::text), ('Juan Dela Cruz'::text, '09171234567'::text) $$,
  'GCash name and number are copied from the club');

update public.clubs set gcash_name = 'Maria Santos', gcash_number = '09998887777', default_fee = 300
where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select results_eq(
  $$ select gcash_name, gcash_number, fee from public.sessions where id = pg_temp.s('d1') $$,
  $$ values ('Juan Dela Cruz'::text, '09171234567'::text, 200) $$,
  'Changing the club later does not change an existing session (snapshot)');

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select set_config('test.d3', public.create_session(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Sunday Social', '2026-11-29 16:00+08', '2026-11-29 19:00+08', 2)::text, true);
reset role;
select results_eq(
  $$ select gcash_name, gcash_number, fee from public.sessions where id = pg_temp.s('d3') $$,
  $$ values ('Maria Santos'::text, '09998887777'::text, 300) $$,
  'A new session takes the club''s current GCash and default fee');

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select set_config('test.b1', public.create_session(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'B Night', '2026-11-27 19:00+08', '2026-11-27 22:00+08', 1)::text, true);
reset role;
select results_eq(
  $$ select gcash_name, gcash_number from public.sessions where id = pg_temp.s('b1') $$,
  $$ values (null::text, null::text) $$,
  'A club without GCash gives a session without GCash');

select is((select count(distinct join_code)::int from public.sessions), (select count(*)::int from public.sessions),
  'Every session has its own join_code');

-- Validation errors come from the table constraints.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select throws_ok($$ select public.create_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Bad', now(), now() + interval '1h', 0) $$,
  '23514', null, 'create_session: courts 0 refused');
select throws_ok($$ select public.create_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Bad', now(), now() + interval '1h', 9) $$,
  '23514', null, 'create_session: courts 9 refused');
select throws_ok($$ select public.create_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Bad', now(), now() - interval '1h', 2) $$,
  '23514', null, 'create_session: ends before starts refused');
select throws_ok($$ select public.create_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Bad', now(), now() + interval '1h', 2, p_points_to => 12) $$,
  '23514', null, 'create_session: points 12 refused');
select throws_ok($$ select public.create_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Bad', now(), now() + interval '1h', 2, p_rotation => 'random') $$,
  '23514', null, 'create_session: unknown rotation refused');
select throws_ok($$ select public.create_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Bad', now(), now() + interval '1h', 2, p_fee => -5) $$,
  '23514', null, 'create_session: negative fee refused');
select throws_ok($$ select public.create_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '   ', now(), now() + interval '1h', 2) $$,
  '23514', null, 'create_session: blank name refused');
select throws_ok($$ select public.create_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, now(), now() + interval '1h', 2) $$,
  '23502', null, 'create_session: missing name refused');
reset role;

-- ---------------------------------------------------------------------------
-- draft -> live (start_session) and BR1
-- ---------------------------------------------------------------------------
select is(public.is_checkin_open((select join_code from public.sessions where id = pg_temp.s('d1'))), false,
  'is_checkin_open is false for a draft');

select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select lives_ok($$ select public.start_session(pg_temp.s('d1')) $$, 'Organizer starts a draft');
reset role;
select ok((select status = 'live' and started_at is not null and ended_at is null from public.sessions where id = pg_temp.s('d1')),
  'Started session is live with started_at set');

select is(public.is_checkin_open((select join_code from public.sessions where id = pg_temp.s('d1'))), true,
  'is_checkin_open is true for the live session');
select is(public.is_checkin_open(' ' || lower((select join_code from public.sessions where id = pg_temp.s('d1'))) || ' '), true,
  'is_checkin_open ignores case and surrounding spaces');

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select throws_ok($$ select public.start_session(pg_temp.s('d2')) $$,
  'P0001', 'live_session_exists', 'BR1: starting a second session while one is live fails');
select throws_ok($$ select public.start_session(pg_temp.s('d1')) $$,
  'P0001', 'invalid_transition', 'live -> live (start again) is refused');
select throws_ok(
  $$ select public.create_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Start now', now(), now() + interval '3h', 2, p_start => true) $$,
  'P0001', 'live_session_exists', 'BR1: create-and-start fails while another session is live');
reset role;
select is((select status from public.sessions where id = pg_temp.s('d2')), 'draft', 'The refused session stays a draft');
select is((select count(*)::int from public.sessions where name = 'Start now'), 0,
  'A refused create-and-start leaves no stray draft');
select is((select count(*)::int from public.sessions where club_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and status = 'live'), 1,
  'Club A has exactly one live session');

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select lives_ok($$ select public.start_session(pg_temp.s('b1')) $$, 'BR1 is per club: Club B starts while Club A is live');
reset role;

-- Refused while live.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select throws_ok($$ select public.delete_draft_session(pg_temp.s('d1')) $$,
  'P0001', 'invalid_transition', 'A live session cannot be deleted');
select throws_ok($$ select public.end_session(pg_temp.s('d2')) $$,
  'P0001', 'invalid_transition', 'draft -> ended (end a draft) is refused');
reset role;
select is((select status from public.sessions where id = pg_temp.s('d2')), 'draft', 'The draft is still a draft');

-- ---------------------------------------------------------------------------
-- live -> ended (end_session, BR4) and ended is final
-- ---------------------------------------------------------------------------
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select lives_ok($$ select public.end_session(pg_temp.s('d1')) $$, 'Organizer ends the live session');
reset role;
select ok((select status = 'ended' and ended_at is not null and started_at is not null from public.sessions where id = pg_temp.s('d1')),
  'Ended session has status ended and ended_at');
select is(public.is_checkin_open((select join_code from public.sessions where id = pg_temp.s('d1'))), false,
  'BR4: check-in is closed once the session ends');

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select throws_ok($$ select public.start_session(pg_temp.s('d1')) $$,
  'P0001', 'invalid_transition', 'ended -> live is refused');
select throws_ok($$ select public.end_session(pg_temp.s('d1')) $$,
  'P0001', 'invalid_transition', 'ended -> ended (end again) is refused');
select throws_ok($$ select public.delete_draft_session(pg_temp.s('d1')) $$,
  'P0001', 'invalid_transition', 'An ended session cannot be deleted');
reset role;
select ok((select status = 'ended' from public.sessions where id = pg_temp.s('d1')), 'The ended session stays ended');

-- With nothing live, another draft can start, and create-and-start works.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select lives_ok($$ select public.start_session(pg_temp.s('d2')) $$, 'After ending, another draft can start');
select lives_ok($$ select public.end_session(pg_temp.s('d2')) $$, 'and end');
select set_config('test.now1', public.create_session(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Start now', now(), now() + interval '3h', 2, p_start => true)::text, true);
reset role;
select ok((select status = 'live' and started_at is not null from public.sessions where id = pg_temp.s('now1')),
  'create_session with p_start creates a live session in one step');

-- ---------------------------------------------------------------------------
-- delete_draft_session
-- ---------------------------------------------------------------------------
select set_config('test.d3_code', (select join_code from public.sessions where id = pg_temp.s('d3')), true);
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select lives_ok($$ select public.delete_draft_session(pg_temp.s('d3')) $$, 'Organizer deletes a draft');
select throws_ok($$ select public.delete_draft_session(pg_temp.s('d3')) $$,
  'P0001', 'session_not_found', 'Deleting it again: session_not_found');
select throws_ok($$ select public.start_session(pg_temp.s('d3')) $$,
  'P0001', 'session_not_found', 'A deleted draft cannot be started');
reset role;
select is((select count(*)::int from public.sessions where id = pg_temp.s('d3')), 0, 'The draft row is gone');
select is(public.is_checkin_open(current_setting('test.d3_code')), false, 'is_checkin_open is false for a deleted code');

-- ---------------------------------------------------------------------------
-- is_checkin_open: other inputs, and who may call it
-- ---------------------------------------------------------------------------
select is(public.is_checkin_open('ZZZZZZ'), false, 'is_checkin_open is false for an unknown code');
select is(public.is_checkin_open(''), false, 'is_checkin_open is false for an empty code');
select is(public.is_checkin_open(null), false, 'is_checkin_open is false for null');

-- Players (Phase 4) may ask before signing in, or with an anonymous session.
select set_config('test.live_code', (select join_code from public.sessions where id = pg_temp.s('now1')), true);
set local role anon;
select is(public.is_checkin_open(current_setting('test.live_code')), true, 'anon can ask is_checkin_open for a live code');
reset role;
select pg_temp.as_user('77777777-7777-7777-7777-777777777777', '{"is_anonymous": true}');
select is(public.is_checkin_open(current_setting('test.live_code')), true,
  'an anonymous (player) session can ask is_checkin_open');
reset role;

select * from finish();
rollback;
