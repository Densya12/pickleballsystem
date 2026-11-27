-- Brand-neutral payments: the club's payment method (gcash | maya | bank |
-- other + name) and cash accepted, on clubs and copied to new sessions.
-- Existing rows become GCash with cash accepted; the column names and
-- payments.method values ('gcash', 'cash') stay as they are.
-- Run: npm run test:db   (needs the local stack: npx supabase start)
begin;
select plan(28);

create function pg_temp.as_user(p_sub uuid, p_extra jsonb default '{}') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', (jsonb_build_object('sub', p_sub, 'role', 'authenticated') || p_extra)::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;
create function pg_temp.as_owner() returns void language sql as $$ select pg_temp.as_user('11111111-1111-1111-1111-111111111111') $$;
create function pg_temp.club() returns uuid language sql as $$ select 'ca000000-0000-0000-0000-000000000000'::uuid $$;
create function pg_temp.new_session(p_name text) returns uuid language sql as $$
  select public.create_session(pg_temp.club(), p_name, now(), now() + interval '3h', 1)
$$;
create function pg_temp.set_club(p_sql text) returns text language plpgsql as $$
declare v_state text;
begin
  execute format('update public.clubs set %s where id = %L', p_sql, pg_temp.club());
  return 'ok';
exception when others then
  get stacked diagnostics v_state = returned_sqlstate;
  return v_state;
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, is_anonymous) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.com', false),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@example.com', false),
  ('77777777-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true);
-- A club as it was before this change: no payment columns given.
insert into public.clubs (id, name, created_by, gcash_name, gcash_number)
values ('ca000000-0000-0000-0000-000000000000', 'Pay Club', '11111111-1111-1111-1111-111111111111', 'Juan', '09171234567');
insert into public.club_staff (club_id, user_id, role) values ('ca000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'owner');
insert into public.clubs (id, name, created_by) values ('cb000000-0000-0000-0000-000000000000', 'Other Club', '22222222-2222-2222-2222-222222222222');
insert into public.club_staff (club_id, user_id, role) values ('cb000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'owner');

-- ---------------------------------------------------------------------------
-- Columns, defaults, privileges
-- ---------------------------------------------------------------------------
select results_eq($$ select payment_method, payment_method_other, cash_accepted from public.clubs where id = pg_temp.club() $$,
  $$ values ('gcash'::text, null::text, true) $$, 'An existing club becomes GCash with cash accepted');
select col_not_null('public', 'sessions', 'payment_method', 'sessions.payment_method is required');
select col_default_is('public', 'sessions', 'payment_method', 'gcash', 'Existing sessions become GCash');
select col_default_is('public', 'sessions', 'cash_accepted', 'true', 'Existing sessions accept cash');
select ok(has_column_privilege('authenticated', 'public.clubs', 'payment_method', 'UPDATE')
          and has_column_privilege('authenticated', 'public.clubs', 'payment_method_other', 'UPDATE')
          and has_column_privilege('authenticated', 'public.clubs', 'cash_accepted', 'UPDATE'),
  'Owners can update the club''s method, Other name and cash accepted (RLS: owners only)');
select ok(has_column_privilege('authenticated', 'public.sessions', 'payment_method', 'SELECT')
          and has_column_privilege('authenticated', 'public.sessions', 'payment_method_other', 'SELECT')
          and has_column_privilege('authenticated', 'public.sessions', 'cash_accepted', 'SELECT'),
  'Staff and the session''s players can read the session''s method');
select ok(not has_column_privilege('authenticated', 'public.sessions', 'payment_method', 'UPDATE'),
  'A session''s method is copied, never edited directly');
select is((select array_agg(p.parameter_name::text order by p.ordinal_position) from information_schema.parameters p
           join information_schema.routines r on r.specific_name = p.specific_name
           where r.routine_schema = 'public' and r.routine_name = 'create_session' and p.parameter_mode = 'IN'),
  array['p_club_id', 'p_name', 'p_starts_at', 'p_ends_at', 'p_courts_count', 'p_points_to', 'p_rotation', 'p_pay_first', 'p_fee', 'p_start', 'p_court_formats'],
  'create_session keeps its signature');

-- ---------------------------------------------------------------------------
-- New sessions copy the club's payment method
-- ---------------------------------------------------------------------------
select pg_temp.as_owner();
select set_config('test.s1', pg_temp.new_session('Default')::text, true);
select results_eq($$ select payment_method, payment_method_other, cash_accepted, gcash_name, gcash_number from public.sessions where id = current_setting('test.s1')::uuid $$,
  $$ values ('gcash'::text, null::text, true, 'Juan'::text, '09171234567'::text) $$, 'A new session copies GCash, cash accepted and the account');

update public.clubs set payment_method = 'maya', cash_accepted = false where id = pg_temp.club();
select set_config('test.s2', pg_temp.new_session('Maya')::text, true);
select results_eq($$ select payment_method, cash_accepted, gcash_number from public.sessions where id = current_setting('test.s2')::uuid $$,
  $$ values ('maya'::text, false, '09171234567'::text) $$, 'Maya, no cash: copied to the new session');
select results_eq($$ select payment_method, cash_accepted from public.sessions where id = current_setting('test.s1')::uuid $$,
  $$ values ('gcash'::text, true) $$, 'Sessions created earlier keep what they had');

update public.clubs set payment_method = 'other', payment_method_other = '  ShopeePay  ', gcash_number = '1234 5678' where id = pg_temp.club();
select results_eq($$ select payment_method, payment_method_other, gcash_number from public.clubs where id = pg_temp.club() $$,
  $$ values ('other'::text, 'ShopeePay'::text, '12345678'::text) $$, 'Other: the name is trimmed; account digits are stored without spaces');
select set_config('test.s3', pg_temp.new_session('Other')::text, true);
select results_eq($$ select payment_method, payment_method_other from public.sessions where id = current_setting('test.s3')::uuid $$,
  $$ values ('other'::text, 'ShopeePay'::text) $$, 'The Other name is copied too');

update public.clubs set payment_method = 'bank', gcash_number = '001234567890' where id = pg_temp.club();
select results_eq($$ select payment_method, payment_method_other, gcash_number from public.clubs where id = pg_temp.club() $$,
  $$ values ('bank'::text, null::text, '001234567890'::text) $$, 'Leaving Other drops its name; bank account numbers are allowed for Bank transfer');
select set_config('test.s4', pg_temp.new_session('Bank')::text, true);
select is((select gcash_number from public.sessions where id = current_setting('test.s4')::uuid), '001234567890', 'A bank account number is copied to the session');

-- ---------------------------------------------------------------------------
-- Constraints
-- ---------------------------------------------------------------------------
select is(pg_temp.set_club($$ payment_method = 'crypto' $$), '23514', 'Unknown methods are refused');
select is(pg_temp.set_club($$ payment_method = 'other', payment_method_other = null $$), '23514', 'Other needs a name');
select is(pg_temp.set_club($$ payment_method = 'other', payment_method_other = 'x' $$), '23514', 'Other''s name: at least 2 characters');
select is(pg_temp.set_club(format('payment_method = %L, payment_method_other = %L', 'other', repeat('x', 31))), '23514', 'Other''s name: at most 30 characters');
select is(pg_temp.set_club($$ payment_method = 'bank', gcash_number = '123' $$), '23514', 'Bank: at least 4 digits');
select is(pg_temp.set_club(format('payment_method = %L, gcash_number = %L', 'bank', repeat('1', 31))), '23514', 'Bank: at most 30 digits');
select is(pg_temp.set_club($$ payment_method = 'gcash', gcash_number = '001234567890' $$), '23514', 'GCash keeps the mobile number rule');
select is(pg_temp.set_club($$ payment_method = 'maya', gcash_number = '0917 123 4567' $$), 'ok', 'Maya takes a mobile number');
select is(pg_temp.set_club($$ payment_method = 'maya', gcash_number = '001234567890' $$), '23514', 'Maya keeps the mobile number rule too');

-- ---------------------------------------------------------------------------
-- Who can change it
-- ---------------------------------------------------------------------------
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
update public.clubs set payment_method = 'gcash' where id = pg_temp.club();
select pg_temp.as_owner();
select is((select payment_method from public.clubs where id = pg_temp.club()), 'maya', 'Another club''s owner can''t change it (RLS)');

-- A player of a session reads its method (to know where to pay).
reset role;
update public.sessions set status = 'live', started_at = now() where id = current_setting('test.s2')::uuid;
select set_config('test.code', (select join_code from public.sessions where id = current_setting('test.s2')::uuid), true);
select pg_temp.as_user('77777777-0000-0000-0000-000000000001', '{"is_anonymous": true}');
select public.join_session(current_setting('test.code'), 'Ana');
select results_eq($$ select payment_method, cash_accepted from public.sessions where id = current_setting('test.s2')::uuid $$,
  $$ values ('maya'::text, false) $$, 'A checked-in player reads the session''s method and cash rule');
select is((select count(*)::int from public.clubs where id = pg_temp.club()), 0, 'Players don''t read the club row');

-- payments.method keeps its values.
reset role;
select ok(pg_get_constraintdef((select oid from pg_constraint where conname = 'payments_method_allowed')) like '%''gcash''%''cash''%',
  'payments.method is still gcash or cash (gcash = paid to the club''s account)');

select * from finish();
rollback;
