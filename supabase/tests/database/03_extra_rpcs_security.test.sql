-- Security of the two read RPCs added beyond the brief:
--   list_club_staff(club_id): rows only for staff of that club; everyone else errors.
--   invite_preview(token):    club name only for a usable token; otherwise a
--                             status word and no club data.
begin;
select plan(23);

-- A owns Club A, C organizes Club A, B owns Club B, D has no club,
-- R was an organizer of Club A and gets removed.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner.a@example.com', '{"full_name":"Owner A"}'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner.b@example.com', '{}'),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'organizer.c@example.com', '{}'),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'outsider.d@example.com', '{}'),
  ('66666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'removed.r@example.com', '{}');

insert into public.clubs (id, name, created_by) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Club A', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Club B', '22222222-2222-2222-2222-222222222222');

insert into public.club_staff (club_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'organizer'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '66666666-6666-6666-6666-666666666666', 'organizer'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'owner');

insert into public.club_invites (club_id, token, expires_at, used_by, used_at, revoked_at) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'tok-valid',   now() + interval '7 days', null, null, null),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'tok-expired', now() - interval '1 minute', null, null, null),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'tok-used',    now() + interval '7 days', '33333333-3333-3333-3333-333333333333', now(), null),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'tok-revoked', now() + interval '7 days', null, null, now());

-- R is removed from Club A before any checks.
delete from public.club_staff
where club_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and user_id = '66666666-6666-6666-6666-666666666666';

-- ===========================================================================
-- list_club_staff
-- ===========================================================================

-- Staff of the club get the rows.
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select email from public.list_club_staff('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  $$ values ('owner.a@example.com'::text), ('organizer.c@example.com'::text) $$,
  'list_club_staff: owner of Club A gets exactly Club A staff');
select throws_ok($$ select * from public.list_club_staff('cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
  '42501', 'not_staff', 'list_club_staff: unknown club id is refused');
reset role;

select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.list_club_staff('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')), 2,
  'list_club_staff: organizer (non-owner) of Club A can list Club A staff');
reset role;

-- Everyone else is refused.
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select * from public.list_club_staff('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  '42501', 'not_staff', 'list_club_staff: owner of another club is refused');
select results_eq(
  $$ select email from public.list_club_staff('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') $$,
  $$ values ('owner.b@example.com'::text) $$,
  'list_club_staff: Club B owner sees only Club B staff (no Club A emails)');
reset role;

select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select * from public.list_club_staff('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  '42501', 'not_staff', 'list_club_staff: signed-in user with no club is refused');
reset role;

select set_config('request.jwt.claims', '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select * from public.list_club_staff('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  '42501', 'not_staff', 'list_club_staff: removed organizer is refused');
reset role;

select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select * from public.list_club_staff('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  '42501', 'not_staff', 'list_club_staff: token without a user id is refused');
reset role;

set local role anon;
select throws_ok($$ select * from public.list_club_staff('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  '42501', null, 'list_club_staff: anon (signed-out player) cannot execute it');
reset role;

-- ===========================================================================
-- invite_preview
-- ===========================================================================

select is(
  (select string_agg(parameter_name, ',' order by ordinal_position)
   from information_schema.parameters p
   join information_schema.routines r using (specific_schema, specific_name)
   where r.routine_schema = 'public' and r.routine_name = 'invite_preview' and p.parameter_mode = 'OUT'),
  'status,club_name,already_staff',
  'invite_preview returns only status, club_name, already_staff (no club id)');

-- Outsider D (signed in, not staff anywhere).
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
set local role authenticated;
select results_eq($$ select status, club_name, already_staff from public.invite_preview('tok-valid') $$,
  $$ values ('valid'::text, 'Club A'::text, false) $$,
  'invite_preview: valid token shows the club name');
select results_eq($$ select status, club_name, already_staff from public.invite_preview('tok-expired') $$,
  $$ values ('expired'::text, null::text, false) $$,
  'invite_preview: expired token reveals no club name');
select results_eq($$ select status, club_name, already_staff from public.invite_preview('tok-used') $$,
  $$ values ('used'::text, null::text, false) $$,
  'invite_preview: used token reveals no club name');
select results_eq($$ select status, club_name, already_staff from public.invite_preview('tok-revoked') $$,
  $$ values ('revoked'::text, null::text, false) $$,
  'invite_preview: revoked token reveals no club name');
select results_eq($$ select status, club_name, already_staff from public.invite_preview('no-such-token') $$,
  $$ values ('invalid'::text, null::text, false) $$,
  'invite_preview: unknown token reveals nothing');
select results_eq($$ select status, club_name, already_staff from public.invite_preview('') $$,
  $$ values ('invalid'::text, null::text, false) $$,
  'invite_preview: empty token reveals nothing');
select results_eq($$ select status, club_name, already_staff from public.invite_preview(null) $$,
  $$ values ('invalid'::text, null::text, false) $$,
  'invite_preview: null token reveals nothing');
select results_eq($$ select status, club_name from public.invite_preview('tok-%') $$,
  $$ values ('invalid'::text, null::text) $$,
  'invite_preview: wildcard-looking token is matched literally');
reset role;

-- Staff of another club gets no more than an outsider.
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;
select results_eq($$ select status, club_name, already_staff from public.invite_preview('tok-expired') $$,
  $$ values ('expired'::text, null::text, false) $$,
  'invite_preview: owner of another club sees no name on a spent token');
reset role;

-- Existing staff of Club A may see their own club name on a spent link.
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;
select results_eq($$ select status, club_name, already_staff from public.invite_preview('tok-used') $$,
  $$ values ('valid'::text, 'Club A'::text, true) $$,
  'invite_preview: existing staff see their own club (already_staff)');
reset role;

-- Removed organizer is treated like anyone else.
select set_config('request.jwt.claims', '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', true);
set local role authenticated;
select results_eq($$ select status, club_name, already_staff from public.invite_preview('tok-revoked') $$,
  $$ values ('revoked'::text, null::text, false) $$,
  'invite_preview: removed organizer sees no name on a revoked token');
reset role;

select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select * from public.invite_preview('tok-valid') $$,
  '42501', 'not_authenticated', 'invite_preview: token without a user id is refused');
reset role;

set local role anon;
select throws_ok($$ select * from public.invite_preview('tok-valid') $$,
  '42501', null, 'invite_preview: anon (signed-out visitor) cannot execute it');
reset role;

select * from finish();
rollback;
