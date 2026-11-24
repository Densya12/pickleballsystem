-- create_club, accept_invite, remove_staff, list_club_staff, invite_preview
-- and clubs column constraints/normalization.
begin;
select plan(42);

-- A: owner. C, D: other users. E: second owner (added later).
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner.a@example.com', '{"full_name":"Owner A"}'),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'organizer.c@example.com', '{}'),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'outsider.d@example.com', '{}'),
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner.e@example.com', '{"name":"Owner E"}');

-- ---------------------------------------------------------------------------
-- create_club
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select set_config('test.club_a', public.create_club('  Club A  ', '  Makati  ')::text, true);
select isnt(nullif(current_setting('test.club_a'), ''), null, 'create_club returns an id');
select throws_ok($$ select public.create_club('A', null) $$, '23514', null, 'Club name under 2 chars is rejected');
select throws_ok($$ select public.create_club(repeat('x', 61), null) $$, '23514', null, 'Club name over 60 chars is rejected');
reset role;

select is((select role from public.club_staff where club_id = current_setting('test.club_a')::uuid
           and user_id = '11111111-1111-1111-1111-111111111111'), 'owner',
  'create_club makes the caller owner');
select results_eq(
  $$ select name, city, default_fee, default_points, default_rotation, created_by
     from public.clubs where id = current_setting('test.club_a')::uuid $$,
  $$ values ('Club A'::text, 'Makati'::text, 150, 11, 'all_off'::text, '11111111-1111-1111-1111-111111111111'::uuid) $$,
  'Name/city trimmed, defaults applied, created_by set');

select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select public.create_club('No User Club', null) $$, '42501', 'not_authenticated',
  'create_club requires a signed-in user');
reset role;

-- ---------------------------------------------------------------------------
-- Club settings constraints (as owner A)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select lives_ok($$ update public.clubs set gcash_number = '0917-123 4567' where id = current_setting('test.club_a')::uuid $$,
  'GCash number with dashes/spaces is accepted');
select is((select gcash_number from public.clubs where id = current_setting('test.club_a')::uuid), '09171234567',
  'GCash number is normalized to digits');
select throws_ok($$ update public.clubs set gcash_number = '0817 123 4567' where id = current_setting('test.club_a')::uuid $$,
  '23514', null, 'GCash number must start with 09');
select throws_ok($$ update public.clubs set gcash_number = '0917 123 456' where id = current_setting('test.club_a')::uuid $$,
  '23514', null, 'GCash number must be 11 digits');
select throws_ok($$ update public.clubs set gcash_number = '0917 123 45678' where id = current_setting('test.club_a')::uuid $$,
  '23514', null, 'GCash number longer than 11 digits is rejected');
select lives_ok($$ update public.clubs set gcash_number = '   ', gcash_name = '  ' where id = current_setting('test.club_a')::uuid $$,
  'Blank GCash fields are accepted');
select results_eq(
  $$ select gcash_number, gcash_name from public.clubs where id = current_setting('test.club_a')::uuid $$,
  $$ values (null::text, null::text) $$,
  'Blank GCash fields are stored as null');
select throws_ok($$ update public.clubs set default_points = 12 where id = current_setting('test.club_a')::uuid $$,
  '23514', null, 'Points must be 11, 15 or 21');
select throws_ok($$ update public.clubs set default_rotation = 'random' where id = current_setting('test.club_a')::uuid $$,
  '23514', null, 'Rotation must be all_off or winners_stay');
select throws_ok($$ update public.clubs set default_fee = -1 where id = current_setting('test.club_a')::uuid $$,
  '23514', null, 'Fee must be >= 0');
select lives_ok($$ update public.clubs set default_fee = 0, default_points = 21, default_rotation = 'winners_stay'
                   where id = current_setting('test.club_a')::uuid $$,
  'Valid rule values are accepted');

-- ---------------------------------------------------------------------------
-- Invites + accept_invite (single use)
-- ---------------------------------------------------------------------------
insert into public.club_invites (club_id) values (current_setting('test.club_a')::uuid);
select set_config('test.token', (select token from public.club_invites
  where club_id = current_setting('test.club_a')::uuid), true);
select matches(current_setting('test.token'), '^[A-Za-z0-9_-]{43}$', 'Token is URL-safe base64 of 32 bytes');
select ok((select expires_at between now() + interval '6 days 23 hours' and now() + interval '7 days 1 minute'
           from public.club_invites where token = current_setting('test.token')),
  'Invite expires in 7 days');
reset role;

select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select status, club_name, already_staff from public.invite_preview(current_setting('test.token')) $$,
  $$ values ('valid'::text, 'Club A'::text, false) $$,
  'invite_preview shows a valid invite with the club name');
select is(public.accept_invite(current_setting('test.token')), current_setting('test.club_a')::uuid,
  'accept_invite returns the club id');
reset role;

select is((select role from public.club_staff where club_id = current_setting('test.club_a')::uuid
           and user_id = '33333333-3333-3333-3333-333333333333'), 'organizer',
  'accept_invite adds the caller as organizer');
select ok((select used_by = '33333333-3333-3333-3333-333333333333' and used_at is not null
           from public.club_invites where token = current_setting('test.token')),
  'accept_invite marks the invite used');

select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;
select is(public.accept_invite(current_setting('test.token')), current_setting('test.club_a')::uuid,
  'Already staff: accept_invite just returns the club id');
reset role;

select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
set local role authenticated;
select is((select status from public.invite_preview(current_setting('test.token'))), 'used',
  'invite_preview reports a used invite');
select throws_ok($$ select public.accept_invite(current_setting('test.token')) $$, 'P0001', 'invite_used',
  'A used invite cannot be reused');
select throws_ok($$ select public.accept_invite('no-such-token') $$, 'P0001', 'invite_invalid',
  'Unknown token is rejected');
select is((select status from public.invite_preview('no-such-token')), 'invalid',
  'invite_preview reports an unknown token');
reset role;

insert into public.club_invites (club_id, token, expires_at) values
  (current_setting('test.club_a')::uuid, 'expired-token', now() - interval '1 hour');
insert into public.club_invites (club_id, token, revoked_at) values
  (current_setting('test.club_a')::uuid, 'revoked-token', now());
insert into public.club_invites (club_id, token) values
  (current_setting('test.club_a')::uuid, 'fresh-token');

select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select public.accept_invite('expired-token') $$, 'P0001', 'invite_expired',
  'An expired invite is rejected');
select is((select status from public.invite_preview('expired-token')), 'expired',
  'invite_preview reports an expired invite');
select throws_ok($$ select public.accept_invite('revoked-token') $$, 'P0001', 'invite_revoked',
  'A revoked invite is rejected');
reset role;

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$ update public.club_invites set revoked_at = now() where token = 'fresh-token' $$,
  'Owner can revoke an invite');
select results_eq(
  $$ select email, role, display_name from public.list_club_staff(current_setting('test.club_a')::uuid) $$,
  $$ values ('owner.a@example.com'::text, 'owner'::text, 'Owner A'::text),
            ('organizer.c@example.com'::text, 'organizer'::text, null::text) $$,
  'list_club_staff returns owner first, with name and email');
reset role;

select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select public.accept_invite('fresh-token') $$, 'P0001', 'invite_revoked',
  'An invite revoked by the owner cannot be used');
reset role;

-- ---------------------------------------------------------------------------
-- remove_staff
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select public.remove_staff(current_setting('test.club_a')::uuid, '11111111-1111-1111-1111-111111111111') $$,
  '42501', 'not_owner', 'Organizer cannot remove staff');
reset role;

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select public.remove_staff(current_setting('test.club_a')::uuid, '11111111-1111-1111-1111-111111111111') $$,
  'P0001', 'last_owner', 'The last owner cannot be removed');
select throws_ok($$ select public.remove_staff(current_setting('test.club_a')::uuid, '44444444-4444-4444-4444-444444444444') $$,
  'P0001', 'staff_not_found', 'Removing a non-member fails clearly');
select lives_ok($$ select public.remove_staff(current_setting('test.club_a')::uuid, '33333333-3333-3333-3333-333333333333') $$,
  'Owner can remove an organizer');
reset role;

select is((select count(*)::int from public.club_staff where club_id = current_setting('test.club_a')::uuid
           and user_id = '33333333-3333-3333-3333-333333333333'), 0,
  'Removed organizer is no longer staff');

-- With two owners, one may be removed, but never the last.
insert into public.club_staff (club_id, user_id, role)
values (current_setting('test.club_a')::uuid, '55555555-5555-5555-5555-555555555555', 'owner');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$ select public.remove_staff(current_setting('test.club_a')::uuid, '11111111-1111-1111-1111-111111111111') $$,
  'An owner can be removed while another owner remains');
reset role;

select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select public.remove_staff(current_setting('test.club_a')::uuid, '55555555-5555-5555-5555-555555555555') $$,
  'P0001', 'last_owner', 'The remaining owner cannot remove themselves');
reset role;

select is((select count(*)::int from public.club_staff where club_id = current_setting('test.club_a')::uuid and role = 'owner'), 1,
  'Club still has exactly one owner');

select * from finish();
rollback;
