-- QA-10: D18 (a walk-in in a session with a fee needs a payment choice) and the
-- ₱100,000 fee cap (FEE_MAX), enforced in the database.
-- Run: npm run test:db   (needs the local stack: npx supabase start)
begin;
select plan(13);

create function pg_temp.as_user(p_sub uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_sub, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;
create function pg_temp.err(p_sql text) returns text language plpgsql as $$
declare v_msg text; v_state text;
begin
  execute p_sql;
  return 'no error';
exception when others then
  get stacked diagnostics v_msg = message_text, v_state = returned_sqlstate;
  return case when v_state = 'P0001' then v_msg else v_state || ' ' || v_msg end;
end;
$$;
create function pg_temp.sid(p_key text) returns uuid language sql as $$ select current_setting('test.' || p_key)::uuid $$;

insert into auth.users (id, instance_id, aud, role, email, is_anonymous) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.com', false);
insert into public.clubs (id, name, created_by) values ('ca100000-0000-0000-0000-000000000000', 'QA-10 Club', '11111111-1111-1111-1111-111111111111');
insert into public.club_staff (club_id, user_id, role) values ('ca100000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'owner');

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select set_config('test.s', public.create_session('ca100000-0000-0000-0000-000000000000', 'Paid Night', now(), now() + interval '3h', 1, p_fee => 150, p_start => true)::text, true);

-- D18: with a fee there is no default.
select is(pg_temp.err($$ select public.add_walk_in(pg_temp.sid('s'), 'No Choice', 'unsure') $$), 'payment_required',
  'D18: a walk-in with no payment choice is refused when there is a fee');
select is(pg_temp.err($$ select public.add_walk_in(pg_temp.sid('s'), 'No Choice', 'unsure', null, null, gen_random_uuid()) $$), 'payment_required',
  'D18: also with a client id');
select is((select count(*)::int from public.session_players where session_id = pg_temp.sid('s')), 0, 'Nobody was added');
select is(pg_temp.err($$ select public.add_walk_in(pg_temp.sid('s'), 'Pay Later', 'unsure', 'later') $$), 'no error', '"Pay later" is a choice');
select is(pg_temp.err($$ select public.add_walk_in(pg_temp.sid('s'), 'Cash Paid', 'unsure', 'cash_received') $$), 'no error', 'Cash received works');
select is(pg_temp.err($$ select public.add_walk_in(pg_temp.sid('s'), 'Bad Choice', 'unsure', 'bitcoin') $$), 'invalid_payment_method', 'An unknown choice is still invalid_payment_method');

-- A free session needs no choice.
select public.end_session(pg_temp.sid('s'));
select set_config('test.free', public.create_session('ca100000-0000-0000-0000-000000000000', 'Free Night', now(), now() + interval '3h', 1, p_fee => 0, p_start => true)::text, true);
select is(pg_temp.err($$ select public.add_walk_in(pg_temp.sid('free'), 'Free Walk', 'unsure') $$), 'no error', 'Fee 0: no payment choice needed');

-- Fee cap: ₱100,000.
select is(pg_temp.err($$ select public.create_session('ca100000-0000-0000-0000-000000000000', 'Cap', now(), now() + interval '3h', 1, p_fee => 100000) $$), 'no error',
  'A fee of exactly 100,000 is allowed');
select ok(pg_temp.err($$ select public.create_session('ca100000-0000-0000-0000-000000000000', 'Huge', now(), now() + interval '3h', 1, p_fee => 2147483647) $$) like '23514 %sessions_fee_max%',
  'create_session with a fee above 100,000 is refused (sessions_fee_max)');
select ok(pg_temp.err($$ update public.clubs set default_fee = 9999999 where id = 'ca100000-0000-0000-0000-000000000000' $$) like '23514 %clubs_default_fee_max%',
  'A club default fee above 100,000 is refused');
select is(pg_temp.err($$ update public.clubs set default_fee = 100000 where id = 'ca100000-0000-0000-0000-000000000000' $$), 'no error',
  'A club default fee of 100,000 is allowed');
reset role;
-- As the table owner (no RLS), so this is the constraint itself.
select ok(pg_temp.err($$ update public.sessions set fee = 100001 where id = pg_temp.sid('free') $$) like '23514 %sessions_fee_max%',
  'Updating a session fee above 100,000 is refused');

select ok((select bool_and(convalidated) from pg_constraint where conname in ('sessions_fee_max', 'clubs_default_fee_max')),
  'Both caps are validated (no existing row was above the cap)');

select * from finish();
rollback;
