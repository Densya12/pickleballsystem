-- Phase 2 sessions: constraints, BR1 index, privileges, RLS reads, display_token.
-- Run: npm run test:db   (needs the local stack: npx supabase start)
begin;
select plan(50);

-- Signs in as a user for the following statements (until `reset role`).
create function pg_temp.as_user(p_sub uuid, p_extra jsonb default '{}') returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    (jsonb_build_object('sub', p_sub, 'role', 'authenticated') || p_extra)::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

-- A owns Club A, C organizes Club A, B owns Club B, N has no club.
insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner.a@example.com'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner.b@example.com'),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'organizer.c@example.com'),
  ('88888888-8888-8888-8888-888888888888', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'noclub.n@example.com');

insert into public.clubs (id, name, created_by) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Club A', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Club B', '22222222-2222-2222-2222-222222222222');
insert into public.club_staff (club_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'organizer'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'owner');

-- Sessions inserted directly (as postgres) to test the table on its own.
insert into public.sessions (id, club_id, name, starts_at, ends_at, courts_count, points_to, rotation, fee) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A One', '2026-11-27 18:00+08', '2026-11-27 21:00+08', 2, 11, 'all_off', 150),
  ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A Two', '2026-11-28 18:00+08', '2026-11-28 21:00+08', 2, 11, 'all_off', 150),
  ('b0000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'B One', '2026-11-27 18:00+08', '2026-11-27 21:00+08', 2, 11, 'all_off', 150);

-- ---------------------------------------------------------------------------
-- BR1 in the database itself
-- ---------------------------------------------------------------------------
select is(
  (select indexdef from pg_indexes where schemaname = 'public' and indexname = 'sessions_one_live_per_club'),
  'CREATE UNIQUE INDEX sessions_one_live_per_club ON public.sessions USING btree (club_id) WHERE (status = ''live''::text)',
  'BR1: partial unique index on club_id where status = live');

update public.sessions set status = 'live', started_at = now() where id = 'a0000000-0000-0000-0000-000000000001';
-- A second live row is what two racing starts would produce if both passed
-- an app-level check. The index rejects it regardless of how it is written.
select throws_ok(
  $$ update public.sessions set status = 'live', started_at = now() where id = 'a0000000-0000-0000-0000-000000000002' $$,
  '23505', null, 'BR1: a second live session in the same club is rejected by the database');
select lives_ok(
  $$ update public.sessions set status = 'live', started_at = now() where id = 'b0000000-0000-0000-0000-000000000001' $$,
  'BR1 is per club: Club B can be live at the same time');
select is((select count(*)::int from public.sessions where club_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and status = 'live'), 1,
  'Club A still has exactly one live session');

-- ---------------------------------------------------------------------------
-- Transition guard (trigger): only draft -> live -> ended, even for direct SQL
-- ---------------------------------------------------------------------------
select throws_ok($$ update public.sessions set status = 'draft', started_at = null where id = 'a0000000-0000-0000-0000-000000000001' $$,
  'P0001', 'invalid_transition', 'live -> draft is refused');
select throws_ok($$ update public.sessions set status = 'ended', started_at = now(), ended_at = now() where id = 'a0000000-0000-0000-0000-000000000002' $$,
  'P0001', 'invalid_transition', 'draft -> ended is refused');
select throws_ok($$ update public.sessions set status = 'paused' where id = 'a0000000-0000-0000-0000-000000000002' $$,
  'P0001', 'invalid_transition', 'unknown status is refused');
select throws_ok($$ insert into public.sessions (club_id, name, starts_at, ends_at, status, started_at, courts_count, points_to, rotation, fee)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Born live', now(), now() + interval '1h', 'live', now(), 1, 11, 'all_off', 0) $$,
  'P0001', 'invalid_transition', 'a session cannot be inserted as live');
select lives_ok($$ update public.sessions set status = 'ended', ended_at = now() where id = 'a0000000-0000-0000-0000-000000000001' $$,
  'live -> ended is allowed');
select throws_ok($$ update public.sessions set status = 'live', ended_at = null where id = 'a0000000-0000-0000-0000-000000000001' $$,
  'P0001', 'invalid_transition', 'ended -> live is refused (ended is final)');
select throws_ok($$ update public.sessions set status = 'draft', started_at = null, ended_at = null where id = 'a0000000-0000-0000-0000-000000000001' $$,
  'P0001', 'invalid_transition', 'ended -> draft is refused (ended is final)');
select throws_ok($$ update public.sessions set started_at = null where id = 'b0000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'a live session must have started_at');

-- ---------------------------------------------------------------------------
-- Check constraints: allowed values pass, others fail
-- ---------------------------------------------------------------------------
create function pg_temp.try_insert(p_courts int, p_points int, p_rotation text, p_fee int,
  p_name text default 'Valid name', p_hours int default 3) returns void
language sql as $$
  insert into public.sessions (club_id, name, starts_at, ends_at, courts_count, points_to, rotation, fee)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', p_name, '2026-12-01 18:00+08',
          '2026-12-01 18:00+08'::timestamptz + make_interval(hours => p_hours), p_courts, p_points, p_rotation, p_fee);
$$;

select lives_ok($$ select pg_temp.try_insert(1, 11, 'all_off', 0) $$, 'courts 1, points 11, all_off, fee 0 allowed');
select lives_ok($$ select pg_temp.try_insert(8, 15, 'winners_stay', 150) $$, 'courts 8, points 15, winners_stay allowed');
select lives_ok($$ select pg_temp.try_insert(4, 21, 'all_off', 500) $$, 'points 21 allowed');
select throws_ok($$ select pg_temp.try_insert(0, 11, 'all_off', 0) $$, '23514', null, 'courts 0 refused');
select throws_ok($$ select pg_temp.try_insert(9, 11, 'all_off', 0) $$, '23514', null, 'courts 9 refused');
select throws_ok($$ select pg_temp.try_insert(2, 12, 'all_off', 0) $$, '23514', null, 'points 12 refused');
select throws_ok($$ select pg_temp.try_insert(2, 11, 'everyone_stays', 0) $$, '23514', null, 'unknown rotation refused');
select throws_ok($$ select pg_temp.try_insert(2, 11, 'all_off', -1) $$, '23514', null, 'negative fee refused');
select throws_ok($$ select pg_temp.try_insert(2, 11, 'all_off', 0, 'Zero length', 0) $$, '23514', null, 'ends_at = starts_at refused');
select throws_ok($$ select pg_temp.try_insert(2, 11, 'all_off', 0, 'Backwards', -2) $$, '23514', null, 'ends_at before starts_at refused');
select throws_ok($$ select pg_temp.try_insert(2, 11, 'all_off', 0, '  x  ') $$, '23514', null, 'name shorter than 2 (after trim) refused');
select throws_ok($$ select pg_temp.try_insert(2, 11, 'all_off', 0, repeat('n', 61)) $$, '23514', null, 'name longer than 60 refused');
select throws_ok($$ update public.sessions set join_code = 'ABC10O' where id = 'a0000000-0000-0000-0000-000000000002' $$,
  '23514', null, 'join_code with look-alike characters refused');
select throws_ok($$ update public.sessions set gcash_number = '12345' where id = 'a0000000-0000-0000-0000-000000000002' $$,
  '23514', null, 'gcash_number snapshot must be 09 + 9 digits');

-- Generated codes and tokens
select is(
  (select count(*)::int from generate_series(1, 500) g
   where private.generate_join_code() !~ '^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$'),
  0, '500 generated join codes are 6 characters without 0, O, 1, I or L');
select ok(
  (select bool_and(join_code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$' and display_token ~ '^[A-Za-z0-9_-]{43}$')
   from public.sessions),
  'every session got a join_code and a 43-character base64url display_token');
select throws_ok(
  $$ update public.sessions set join_code = (select join_code from public.sessions where id = 'b0000000-0000-0000-0000-000000000001')
     where id = 'a0000000-0000-0000-0000-000000000002' $$,
  '23505', null, 'join_code is unique');
select throws_ok(
  $$ update public.sessions set display_token = (select display_token from public.sessions where id = 'b0000000-0000-0000-0000-000000000001')
     where id = 'a0000000-0000-0000-0000-000000000002' $$,
  '23505', null, 'display_token is unique');

-- ---------------------------------------------------------------------------
-- RLS reads: staff see their own club's sessions only
-- ---------------------------------------------------------------------------
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is((select count(*)::int from public.sessions where club_id <> 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 0,
  'Owner A sees no other club''s sessions');
select ok((select count(*)::int from public.sessions) > 0, 'Owner A sees Club A sessions');
reset role;

select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select is((select count(*)::int from public.sessions where club_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  (select count(*)::int from public.sessions where club_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'Organizer C reads Club A sessions');
select is((select count(*)::int from public.sessions where club_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 0,
  'Organizer C cannot read Club B sessions');
reset role;

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select is((select count(*)::int from public.sessions where club_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 0,
  'Owner B cannot read Club A sessions');
select is((select array_agg(name)::text from public.sessions), '{"B One"}', 'Owner B reads only Club B''s session');
reset role;

select pg_temp.as_user('88888888-8888-8888-8888-888888888888');
select is((select count(*)::int from public.sessions), 0, 'A user with no club reads no sessions');
reset role;

-- ---------------------------------------------------------------------------
-- Privileges: display_token is never readable; no direct writes
-- ---------------------------------------------------------------------------
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select throws_ok($$ select display_token from public.sessions $$, '42501', null,
  'Staff cannot select display_token, even for their own club');
select throws_ok($$ select * from public.sessions $$, '42501', null,
  'select * is refused because it includes display_token');
select lives_ok(
  $$ select id, club_id, name, starts_at, ends_at, status, courts_count, points_to, rotation, pay_first, fee,
            gcash_name, gcash_number, join_code, created_by, created_at, started_at, ended_at
     from public.sessions $$,
  'Staff can select every other column');
select throws_ok(
  $$ insert into public.sessions (club_id, name, starts_at, ends_at, courts_count, points_to, rotation, fee)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Direct', now(), now() + interval '1h', 1, 11, 'all_off', 0) $$,
  '42501', null, 'Staff cannot insert sessions directly');
select throws_ok($$ update public.sessions set status = 'live' where id = 'a0000000-0000-0000-0000-000000000002' $$,
  '42501', null, 'Staff cannot update sessions directly');
select throws_ok($$ delete from public.sessions where id = 'a0000000-0000-0000-0000-000000000002' $$,
  '42501', null, 'Staff cannot delete sessions directly');
reset role;

select ok(not has_table_privilege('anon', 'public.sessions', 'select'), 'anon has no select on sessions');
select ok(not has_column_privilege('authenticated', 'public.sessions', 'display_token', 'select'),
  'authenticated has no select on display_token');

-- No function a client can execute returns the sessions row type or exposes
-- display_token through its result columns.
select is(
  (select count(*)::int
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))
     and (p.prorettype = 'public.sessions'::regtype
          or p.prorettype = 'record'::regtype and 'display_token' = any (coalesce(p.proargnames, '{}'))
          or exists (select 1 from pg_type t where t.oid = p.prorettype and t.typrelid <> 0
                     and exists (select 1 from pg_attribute a where a.attrelid = t.typrelid and a.attname = 'display_token')))),
  0, 'No client-callable function returns display_token');
select is(
  (select array_agg(p.proname || ':' || format_type(p.prorettype, null) order by p.proname)::text
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('create_session', 'start_session', 'end_session', 'delete_draft_session', 'is_checkin_open')),
  '{create_session:uuid,delete_draft_session:void,end_session:void,is_checkin_open:boolean,start_session:void}',
  'Session functions return only an id, nothing, or a boolean');

-- Internal helpers are not reachable by clients.
select ok(not has_schema_privilege('authenticated', 'private', 'usage'), 'authenticated cannot use schema private');
select ok(not has_schema_privilege('anon', 'private', 'usage'), 'anon cannot use schema private');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private'
     and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))),
  0, 'No private helper is executable by authenticated or anon');

select * from finish();
rollback;
