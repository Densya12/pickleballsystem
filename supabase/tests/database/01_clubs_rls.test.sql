-- RLS isolation between clubs, and owner-vs-organizer permissions.
-- Run: npm run test:db   (needs the local stack: npx supabase start)
begin;
select plan(29);

-- Users: A owns Club A, B owns Club B, C is an organizer (non-owner) of Club A.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner.a@example.com', '{"full_name":"Owner A"}'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner.b@example.com', '{"full_name":"Owner B"}'),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'organizer.c@example.com', '{}');

-- A creates Club A + an invite.
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select set_config('test.club_a', public.create_club('Club A', 'Makati')::text, true);
insert into public.club_invites (club_id) values (current_setting('test.club_a')::uuid);
reset role;

-- B creates Club B + an invite.
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;
select set_config('test.club_b', public.create_club('Club B', 'Pasig')::text, true);
insert into public.club_invites (club_id) values (current_setting('test.club_b')::uuid);
reset role;

-- C is an organizer of Club A.
insert into public.club_staff (club_id, user_id, role)
values (current_setting('test.club_a')::uuid, '33333333-3333-3333-3333-333333333333', 'organizer');

-- ---------------------------------------------------------------------------
-- Staff of Club A cannot see or change Club B
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.clubs), 1, 'A sees exactly one club (their own)');
select is((select count(*)::int from public.clubs where id = current_setting('test.club_b')::uuid), 0,
  'A cannot select Club B');
select is((select count(*)::int from public.club_staff where club_id = current_setting('test.club_b')::uuid), 0,
  'A cannot select Club B staff');
select is((select count(*)::int from public.club_invites where club_id = current_setting('test.club_b')::uuid), 0,
  'A cannot read Club B invites');
select lives_ok($$ update public.clubs set name = 'Hacked' where id = current_setting('test.club_b')::uuid $$,
  'A updating Club B is a silent no-op (checked below)');
select throws_ok($$ insert into public.club_invites (club_id) values (current_setting('test.club_b')::uuid) $$,
  '42501', null, 'A cannot create an invite for Club B');
select lives_ok($$ update public.club_invites set revoked_at = now() where club_id = current_setting('test.club_b')::uuid $$,
  'A revoking Club B invites is a silent no-op (checked below)');
select throws_ok($$ select * from public.list_club_staff(current_setting('test.club_b')::uuid) $$,
  '42501', 'not_staff', 'A cannot list Club B staff');
select throws_ok($$ select public.remove_staff(current_setting('test.club_b')::uuid, '22222222-2222-2222-2222-222222222222') $$,
  '42501', 'not_owner', 'A cannot remove Club B staff');
reset role;

select is((select name from public.clubs where id = current_setting('test.club_b')::uuid), 'Club B',
  'Club B name unchanged');
select ok((select bool_and(revoked_at is null) from public.club_invites where club_id = current_setting('test.club_b')::uuid),
  'Club B invites not revoked');

-- ---------------------------------------------------------------------------
-- Organizer (non-owner) of Club A: can read, cannot change settings or invites
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.clubs where id = current_setting('test.club_a')::uuid), 1,
  'Organizer can read their club');
select is((select count(*)::int from public.club_staff where club_id = current_setting('test.club_a')::uuid), 2,
  'Organizer can read their club staff');
select lives_ok($$ update public.clubs set name = 'Organizer edit', default_fee = 999 where id = current_setting('test.club_a')::uuid $$,
  'Organizer updating club settings is a silent no-op (checked below)');
select throws_ok($$ insert into public.club_invites (club_id) values (current_setting('test.club_a')::uuid) $$,
  '42501', null, 'Organizer cannot create invites');
select is((select count(*)::int from public.club_invites), 0, 'Organizer cannot read invites');
select lives_ok($$ update public.club_invites set revoked_at = now() where club_id = current_setting('test.club_a')::uuid $$,
  'Organizer revoking invites is a silent no-op (checked below)');
select throws_ok($$ select public.remove_staff(current_setting('test.club_a')::uuid, '11111111-1111-1111-1111-111111111111') $$,
  '42501', 'not_owner', 'Organizer cannot remove staff');
reset role;

select results_eq(
  $$ select name, default_fee from public.clubs where id = current_setting('test.club_a')::uuid $$,
  $$ values ('Club A'::text, 150) $$,
  'Club A settings unchanged by organizer');
select ok((select bool_and(revoked_at is null) from public.club_invites where club_id = current_setting('test.club_a')::uuid),
  'Club A invite not revoked by organizer');

-- ---------------------------------------------------------------------------
-- Owners: no direct writes outside what the app needs
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select throws_ok($$ insert into public.clubs (name) values ('Sneaky club') $$,
  '42501', null, 'No direct insert into clubs');
select throws_ok($$ delete from public.clubs where id = current_setting('test.club_a')::uuid $$,
  '42501', null, 'No direct delete from clubs');
select throws_ok($$ update public.clubs set created_by = '22222222-2222-2222-2222-222222222222' where id = current_setting('test.club_a')::uuid $$,
  '42501', null, 'Owner cannot change created_by');
select throws_ok($$ insert into public.club_staff (club_id, user_id, role) values (current_setting('test.club_a')::uuid, '22222222-2222-2222-2222-222222222222', 'owner') $$,
  '42501', null, 'No direct insert into club_staff');
select throws_ok($$ update public.club_staff set role = 'owner' where club_id = current_setting('test.club_a')::uuid $$,
  '42501', null, 'No direct update of club_staff');
select throws_ok($$ update public.club_invites set token = 'chosen-token' where club_id = current_setting('test.club_a')::uuid $$,
  '42501', null, 'Owner cannot set an invite token');
select lives_ok($$ update public.clubs set name = 'Club A Updated' where id = current_setting('test.club_a')::uuid $$,
  'Owner can update club settings');
select is((select name from public.clubs where id = current_setting('test.club_a')::uuid), 'Club A Updated',
  'Owner update was saved');
reset role;

-- ---------------------------------------------------------------------------
-- Anonymous visitors (players) get nothing
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok($$ select * from public.clubs $$, '42501', null, 'anon cannot read clubs');
reset role;

select * from finish();
rollback;
