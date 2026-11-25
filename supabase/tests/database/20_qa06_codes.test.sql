-- QA-06: the code preview (anyone with the code, signed out) shows no payment
-- details; they show after check-in. New codes can be 8 characters (a setting,
-- 6 until the app that accepts 8 is deployed); 6-character codes keep working.
-- Run: npm run test:db   (needs the local stack: npx supabase start)
begin;
select plan(13);

create function pg_temp.as_user(p_sub uuid, p_anon boolean default false) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_sub, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;
create function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end;
$$;
create function pg_temp.sid(p_key text) returns uuid language sql as $$ select current_setting('test.' || p_key)::uuid $$;

insert into auth.users (id, instance_id, aud, role, email, is_anonymous) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.com', false),
  ('77777777-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true);
insert into public.clubs (id, name, created_by, gcash_name, gcash_number)
values ('c1000000-0000-0000-0000-000000000000', 'QA-06 Club', '11111111-1111-1111-1111-111111111111', 'Juan Dela Cruz', '09171234567');
insert into public.club_staff (club_id, user_id, role) values ('c1000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'owner');
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select set_config('test.s', public.create_session('c1000000-0000-0000-0000-000000000000', 'QA-06 Night', now(), now() + interval '3h', 1,
  p_fee => 150, p_pay_first => true, p_start => true)::text, true);
reset role;
select set_config('test.code', (select join_code from public.sessions where id = pg_temp.sid('s')), true);

-- The preview, signed out: the session, but no payment details.
select pg_temp.as_anon();
select is((select row(status, name, courts_count)::text from public.checkin_preview(current_setting('test.code'))),
  '(live,"QA-06 Night",1)', 'The preview still shows the session');
select is((select row(fee, pay_first, gcash_name, gcash_number)::text from public.checkin_preview(current_setting('test.code'))),
  '(,,,)', 'No fee, pay-first, GCash name or number before check-in');
-- After check-in, the player sees them (their own session row).
select pg_temp.as_user('77777777-0000-0000-0000-000000000001', true);
select public.join_session(current_setting('test.code'), 'Pia Cruz', 'unsure', null, null);
select is((select row(fee, pay_first, gcash_name, gcash_number)::text from public.sessions where id = pg_temp.sid('s')),
  '(150,t,"Juan Dela Cruz",09171234567)', 'After check-in the player reads the payment details');
reset role;

-- Codes: 6 characters by default (the app on main accepts only 6), from the unambiguous alphabet.
select is(char_length(current_setting('test.code')), 6, 'Default: 6-character join codes');
select ok(current_setting('test.code') ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$', 'No 0/O, 1/I/L');
select is((select join_code_length from private.code_settings), 6, 'The setting starts at 6');
-- Switched to 8 (after the app that accepts 8 is deployed).
update private.code_settings set join_code_length = 8, entry_code_length = 8;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.end_session(pg_temp.sid('s'));
select set_config('test.s8', public.create_session('c1000000-0000-0000-0000-000000000000', 'QA-06 Eight', now(), now() + interval '3h', 1, p_start => true)::text, true);
select set_config('test.entry8', public.regenerate_entry_code('c1000000-0000-0000-0000-000000000000'), true);
reset role;
select ok((select join_code from public.sessions where id = pg_temp.sid('s8')) ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$', 'New join codes: 8 characters');
select ok(current_setting('test.entry8') ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$', 'New club entry codes: 8 characters');
-- 8-character codes work end to end.
select set_config('test.code8', (select join_code from public.sessions where id = pg_temp.sid('s8')), true);
select pg_temp.as_anon();
select is((select status from public.checkin_preview(current_setting('test.code8'))), 'live', 'An 8-character code opens check-in');
select is((select status from public.club_entry(current_setting('test.entry8'))), 'live', 'An 8-character club code finds the live session');
-- Existing 6-character codes keep working.
reset role;
select is(char_length((select join_code from public.sessions where id = pg_temp.sid('s'))), 6, 'The old session keeps its 6-character code');
select throws_ok($$ update public.sessions set join_code = 'ABCDEFG' where id = pg_temp.sid('s8') $$, '23514', null, '7 characters are refused');
select throws_ok($$ update private.code_settings set join_code_length = 7 $$, '23514', null, 'The setting is 6 or 8');

select * from finish();
rollback;
