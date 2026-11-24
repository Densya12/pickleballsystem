-- Anonymous sign-in (players, Phase 4) gets the `authenticated` role, so the
-- staff RPCs must refuse sessions whose JWT has is_anonymous = true.
begin;
select plan(14);

-- A: real owner of Club A. P: anonymous player session. E: real user (control).
insert into auth.users (id, instance_id, aud, role, email, is_anonymous) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner.a@example.com', false),
  ('77777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true),
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'organizer.e@example.com', false);

insert into public.clubs (id, name, created_by) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Club A', '11111111-1111-1111-1111-111111111111');
insert into public.club_staff (club_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner');
insert into public.club_invites (club_id, token) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'tok-for-player');

-- ---------------------------------------------------------------------------
-- Anonymous session: refused, and nothing changes
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated","is_anonymous":true}', true);
set local role authenticated;

select throws_ok($$ select public.create_club('Player Club', 'Pasig') $$,
  '42501', 'not_organizer_account', 'Anonymous session cannot create a club');
select throws_ok($$ select public.accept_invite('tok-for-player') $$,
  '42501', 'not_organizer_account', 'Anonymous session cannot accept a valid invite');
select throws_ok($$ select public.accept_invite('no-such-token') $$,
  '42501', 'not_organizer_account', 'Anonymous check runs before the token lookup');
reset role;

select is((select count(*)::int from public.clubs where created_by = '77777777-7777-7777-7777-777777777777'), 0,
  'No club was created by the anonymous session');
select is((select count(*)::int from public.club_staff where user_id = '77777777-7777-7777-7777-777777777777'), 0,
  'Anonymous session is not staff of any club');
select results_eq(
  $$ select used_by, used_at, revoked_at from public.club_invites where token = 'tok-for-player' $$,
  $$ values (null::uuid, null::timestamptz, null::timestamptz) $$,
  'The invite stays unused after the anonymous attempt');

-- String "true" (as some JWT encoders emit) is also treated as anonymous.
select set_config('request.jwt.claims',
  '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated","is_anonymous":"true"}', true);
set local role authenticated;
select throws_ok($$ select public.create_club('Player Club', null) $$,
  '42501', 'not_organizer_account', 'is_anonymous as a string "true" is refused too');
reset role;

-- ---------------------------------------------------------------------------
-- Controls: real organizer accounts are not affected
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
select is(public.accept_invite('tok-for-player'), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'A real account (is_anonymous = false) can still use the same invite');
select set_config('test.club_e', public.create_club('Club E', null)::text, true);
select isnt(nullif(current_setting('test.club_e'), ''), null,
  'A real account (is_anonymous = false) can create a club');
reset role;

select is((select role from public.club_staff
           where club_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and user_id = '55555555-5555-5555-5555-555555555555'),
  'organizer', 'Real account joined as organizer');
select ok((select used_by = '55555555-5555-5555-5555-555555555555' from public.club_invites where token = 'tok-for-player'),
  'Invite is marked used by the real account');
select is((select role from public.club_staff
           where club_id = current_setting('test.club_e')::uuid and user_id = '55555555-5555-5555-5555-555555555555'),
  'owner', 'Real account is owner of the club it created');

-- Claims without is_anonymous at all (older tokens) behave as non-anonymous.
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$ select public.create_club('Club A2', null) $$,
  'Missing is_anonymous claim is treated as a real account');
reset role;

-- An anonymous session that somehow already has a staff row still cannot add more.
insert into public.club_invites (club_id, token) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'tok-second');
select set_config('request.jwt.claims',
  '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated","is_anonymous":true}', true);
set local role authenticated;
select throws_ok($$ select public.accept_invite('tok-second') $$,
  '42501', 'not_organizer_account', 'Anonymous session is refused on a second invite too');
reset role;

select * from finish();
rollback;
