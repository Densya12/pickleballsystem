-- Phase 5 payments: BR13, BR14, BR15, BR16, BR6 (payment part), own-row and
-- organizer-only rules, NF14 (no player reads another's reference), fee 0.
-- Run: npm run test:db   (needs the local stack: npx supabase start)
begin;
select plan(72);

create function pg_temp.as_user(p_sub uuid, p_extra jsonb default '{}') returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    (jsonb_build_object('sub', p_sub, 'role', 'authenticated') || p_extra)::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;
create function pg_temp.as_player(p_sub uuid) returns void language sql as $$
  select pg_temp.as_user(p_sub, '{"is_anonymous": true}');
$$;
create function pg_temp.sid(p_key text) returns uuid language sql as $$
  select current_setting('test.' || p_key)::uuid;
$$;
create function pg_temp.err(p_sql text) returns text language plpgsql as $$
declare v_msg text; v_detail text; v_state text;
begin
  execute p_sql;
  return 'no error';
exception when others then
  get stacked diagnostics v_msg = message_text, v_detail = pg_exception_detail, v_state = returned_sqlstate;
  return v_msg || case when v_state = 'P0001' then coalesce(':' || nullif(v_detail, ''), '') else '' end;
end;
$$;
-- payments row of a player, as text (read as postgres)
create function pg_temp.pay(p_player uuid) returns text language sql as $$
  select coalesce((select coalesce(method, '-') || '|' || coalesce(reference_digits, '-') || '|' || status || '|' || amount
                   from public.payments where session_player_id = p_player), 'none')
         || '/' || (select payment_status from public.session_players where id = p_player);
$$;

insert into auth.users (id, instance_id, aud, role, email, is_anonymous) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.com', false),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@example.com', false),
  ('77777777-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true),
  ('77777777-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true),
  ('77777777-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true);
insert into public.clubs (id, name, created_by, default_fee) values
  ('c1000000-0000-0000-0000-000000000000', 'Pay First Club', '11111111-1111-1111-1111-111111111111', 150),
  ('c2000000-0000-0000-0000-000000000000', 'Relaxed Club', '11111111-1111-1111-1111-111111111111', 150),
  ('c3000000-0000-0000-0000-000000000000', 'Free Club', '11111111-1111-1111-1111-111111111111', 0),
  ('cb000000-0000-0000-0000-000000000000', 'Other Club', '22222222-2222-2222-2222-222222222222', 150);
insert into public.club_staff (club_id, user_id, role)
select c, '11111111-1111-1111-1111-111111111111', 'owner'
from unnest(array['c1000000-0000-0000-0000-000000000000', 'c2000000-0000-0000-0000-000000000000', 'c3000000-0000-0000-0000-000000000000']::uuid[]) c;
insert into public.club_staff (club_id, user_id, role) values ('cb000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'owner');

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select set_config('test.s1', public.create_session('c1000000-0000-0000-0000-000000000000', 'Pay First Night', now(), now() + interval '3h', 1, p_pay_first => true, p_start => true)::text, true);
select set_config('test.s2', public.create_session('c2000000-0000-0000-0000-000000000000', 'Relaxed Night', now(), now() + interval '3h', 1, p_pay_first => false, p_start => true)::text, true);
select set_config('test.s0', public.create_session('c3000000-0000-0000-0000-000000000000', 'Free Night', now(), now() + interval '3h', 1, p_pay_first => true, p_start => true)::text, true);
reset role;
select set_config('test.code1', (select join_code from public.sessions where id = pg_temp.sid('s1')), true);
select set_config('test.code0', (select join_code from public.sessions where id = pg_temp.sid('s0')), true);

-- ===========================================================================
-- Shared eligibility fixture: private.eligible_players matches every case
-- (the app's isCallable() is checked against the same file in Vitest).
-- ===========================================================================
\ir eligibility_cases.inc
create temporary table cases as
  select row_number() over () as n, c.*
  from jsonb_to_recordset(current_setting('test.eligibility_cases')::jsonb)
       as c(status text, payment text, "payFirst" boolean, fee integer, eligible boolean);
insert into public.clubs (id, name, created_by) values ('cf000000-0000-0000-0000-000000000000', 'Fixture Club', '11111111-1111-1111-1111-111111111111');
-- One (draft) session per pay_first/fee combination; eligibility doesn't depend on live.
create temporary table fixture_sessions as
  select distinct "payFirst" as pay_first, fee, gen_random_uuid() as id from cases;
insert into public.sessions (id, club_id, name, starts_at, ends_at, courts_count, points_to, rotation, pay_first, fee)
select id, 'cf000000-0000-0000-0000-000000000000', 'Fixture ' || pay_first || ' ' || fee, now(), now() + interval '1h', 1, 11, 'all_off', pay_first, fee
from fixture_sessions;
create temporary table case_players as
  select c.n, gen_random_uuid() as player_id, f.id as session_id, c.status, c.payment, c.eligible
  from cases c join fixture_sessions f on f.pay_first = c."payFirst" and f.fee = c.fee;
insert into public.session_players (id, session_id, display_name, status, payment_status)
select player_id, session_id, 'Case ' || n, status, payment from case_players;
select is((select count(*)::int from cases), 36, 'The fixture has 36 cases');
select is(
  (select count(*)::int from case_players cp
   where (cp.player_id in (select e.player_id from private.eligible_players(cp.session_id) e)) <> cp.eligible),
  0, 'private.eligible_players gives the fixture''s answer for every case');

-- ===========================================================================
-- BR13 + BR15: check-in with GCash (pending) or cash (unpaid)
-- ===========================================================================
select pg_temp.as_player('77777777-0000-0000-0000-000000000001');
select set_config('test.p1', public.join_session(current_setting('test.code1'), 'Ana', 'beginner', 'gcash', ' 1234 5678-90 ')::text, true);
reset role;
select is(pg_temp.pay(pg_temp.sid('p1')), 'gcash|1234567890|pending|150/pending',
  'BR13/BR15: GCash with a reference -> pending, stored as digits only, amount = fee');

select pg_temp.as_player('77777777-0000-0000-0000-000000000002');
select is(pg_temp.err($$ select public.join_session(current_setting('test.code1'), 'Ben', 'beginner', 'gcash', 'abc123') $$), 'invalid_reference',
  'Letters in a reference are refused');
select is(pg_temp.err($$ select public.join_session(current_setting('test.code1'), 'Ben', 'beginner', 'gcash', null) $$), 'invalid_reference',
  'GCash without a reference is refused');
select is(pg_temp.err($$ select public.join_session(current_setting('test.code1'), 'Ben', 'beginner', 'card', null) $$), 'invalid_payment_method',
  'Unknown payment method refused');
select is((select count(*)::int from public.my_player(pg_temp.sid('s1'))), 0, 'A refused check-in adds no row');
select set_config('test.p2', public.join_session(current_setting('test.code1'), 'Ben', 'beginner', 'cash')::text, true);
reset role;
select is(pg_temp.pay(pg_temp.sid('p2')), 'cash|-|unpaid|150/unpaid', 'BR13: cash -> unpaid until the organizer confirms');

select pg_temp.as_player('77777777-0000-0000-0000-000000000003');
select set_config('test.p3', public.join_session(current_setting('test.code1'), 'Carlo')::text, true);
reset role;
select is(pg_temp.pay(pg_temp.sid('p3')), 'none/unpaid', 'No choice: unpaid, no payment row yet');

-- BR15 normalizing
select is(private.normalize_reference('12-34 56'), '123456', '6 digits with a dash and a space');
select is(private.normalize_reference(' 1234 5678 9012 3456 7890 '), '12345678901234567890', '20 digits');
select is(pg_temp.err($$ select private.normalize_reference('12345') $$), 'invalid_reference', '5 digits refused');
select is(pg_temp.err($$ select private.normalize_reference('123456789012345678901') $$), 'invalid_reference', '21 digits refused');
select is(pg_temp.err($$ select private.normalize_reference('1234.5678') $$), 'invalid_reference', 'Only spaces and dashes are removed');

-- BR15: a duplicate reference in the same session is accepted (flagged in the app, not rejected).
select pg_temp.as_player('77777777-0000-0000-0000-000000000003');
select lives_ok($$ select public.player_submit_reference(pg_temp.sid('p3'), '1234-5678-90') $$, 'BR15: a duplicate reference is accepted');
reset role;
select is((select count(*)::int from public.payments where session_id = pg_temp.sid('s1') and reference_digits = '1234567890'), 2,
  'Both players carry the same reference (the organizer sees a warning)');

-- ===========================================================================
-- Own row only (player_submit_reference)
-- ===========================================================================
select pg_temp.as_player('77777777-0000-0000-0000-000000000002');
select is(pg_temp.err($$ select public.player_submit_reference(pg_temp.sid('p1'), '999999') $$), 'player_not_found',
  'A player cannot submit a reference for someone else');
reset role;
select is(pg_temp.pay(pg_temp.sid('p1')), 'gcash|1234567890|pending|150/pending', 'Ana''s payment is unchanged');
select pg_temp.as_player('77777777-0000-0000-0000-000000000001');
select lives_ok($$ select public.player_submit_reference(pg_temp.sid('p1'), '5555 6666') $$, 'A player can correct their own pending reference');
reset role;
select is(pg_temp.pay(pg_temp.sid('p1')), 'gcash|55556666|pending|150/pending', 'The reference is replaced');

-- ===========================================================================
-- BR14 / BR6 with pay_first on: unpaid players are skipped
-- ===========================================================================
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(public.session_eligible_count(pg_temp.sid('s1')), 2, 'BR14: the 2 pending (Ana, Carlo) are eligible; unpaid Ben is not');
select set_config('test.w1', public.add_walk_in(pg_temp.sid('s1'), 'Walk Later', 'beginner', 'later')::text, true);
select is(pg_temp.err($$ select public.call_next((select id from public.courts where session_id = pg_temp.sid('s1'))) $$), 'not_enough_players:2',
  'Unpaid players do not count toward a call');
select lives_ok($$ select public.confirm_payment(pg_temp.sid('p2')) $$, 'Natanggap na (cash) for Ben');
select set_config('test.w2', public.add_walk_in(pg_temp.sid('s1'), 'Walk Cash', 'beginner', 'cash_received')::text, true);
select set_config('test.w3', public.add_walk_in(pg_temp.sid('s1'), 'Walk GCash', 'beginner', 'gcash', '777 888 999')::text, true);
select is(pg_temp.err($$ select public.add_walk_in(pg_temp.sid('s1'), 'Walk Bad', 'beginner', 'gcash', 'nope') $$), 'invalid_reference',
  'A walk-in with a bad GCash reference is refused');
select is(pg_temp.err($$ select public.add_walk_in(pg_temp.sid('s1'), 'Walk Bad', 'beginner', 'bitcoin') $$), 'invalid_payment_method',
  'Unknown walk-in payment choice refused');
select set_config('test.g1', public.call_next((select id from public.courts where session_id = pg_temp.sid('s1')))::text, true);
reset role;
select is(pg_temp.pay(pg_temp.sid('w1')), 'none/unpaid', 'Walk-in "later": unpaid, no row');
select is(pg_temp.pay(pg_temp.sid('w2')), 'cash|-|confirmed|150/confirmed', 'Walk-in cash received: confirmed');
select is(pg_temp.pay(pg_temp.sid('w3')), 'gcash|777888999|pending|150/pending', 'Walk-in GCash: pending');
select is((select array_agg(p.display_name order by u.i)::text from public.games g, unnest(g.player_ids) with ordinality u(id, i)
           join public.session_players p on p.id = u.id where g.id = pg_temp.sid('g1')),
  '{Ana,Ben,Carlo,"Walk Cash"}', 'BR6: the call skips the unpaid walk-in and takes the paid/pending players in queue order');
select is((select status from public.session_players where id = pg_temp.sid('w1')), 'queued', 'The unpaid walk-in keeps their place');

-- pay_first off: unpaid players are eligible.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.add_walk_in(pg_temp.sid('s2'), 'Relaxed ' || n, 'beginner', 'later') from generate_series(1, 4) n;
select is(public.session_eligible_count(pg_temp.sid('s2')), 4, 'BR6: with pay_first off, unpaid players are eligible');
reset role;

-- ===========================================================================
-- Organizer-only confirm and undo
-- ===========================================================================
select pg_temp.as_player('77777777-0000-0000-0000-000000000001');
select is(pg_temp.err($$ select public.confirm_payment(pg_temp.sid('p1')) $$), 'not_organizer_account', 'A player cannot confirm (even their own)');
select is(pg_temp.err($$ select public.undo_payment(pg_temp.sid('p2')) $$), 'not_organizer_account', 'A player cannot undo');
reset role;
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select is(pg_temp.err($$ select public.confirm_payment(pg_temp.sid('p1')) $$), 'player_not_found', 'Another club''s owner cannot confirm');
select is(pg_temp.err($$ select public.undo_payment(pg_temp.sid('p2')) $$), 'player_not_found', 'Another club''s owner cannot undo');
reset role;
set local role anon;
select throws_ok($$ select public.confirm_payment(pg_temp.sid('p1')) $$, '42501', null, 'anon cannot call confirm_payment');
reset role;

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select lives_ok($$ select public.confirm_payment(pg_temp.sid('p1')) $$, 'Natanggap na for Ana''s GCash');
select is(pg_temp.err($$ select public.confirm_payment(pg_temp.sid('p1')) $$), 'already_paid', 'Confirming twice is refused');
reset role;
select is(pg_temp.pay(pg_temp.sid('p1')), 'gcash|55556666|confirmed|150/confirmed', 'Confirmed GCash keeps its reference');
select pg_temp.as_player('77777777-0000-0000-0000-000000000001');
select is(pg_temp.err($$ select public.player_submit_reference(pg_temp.sid('p1'), '123456') $$), 'already_paid',
  'A player cannot change a confirmed payment');
reset role;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select lives_ok($$ select public.undo_payment(pg_temp.sid('p1')) $$, 'Undo Ana''s payment (mistake)');
select is(pg_temp.err($$ select public.undo_payment(pg_temp.sid('p1')) $$), 'invalid_payment_status', 'Undo of an unpaid player is refused');
reset role;
select is(pg_temp.pay(pg_temp.sid('p1')), '-|-|unpaid|150/unpaid', 'Undo: back to unpaid, method and reference cleared');

-- ===========================================================================
-- BR16: every change wrote an event with actor and time
-- ===========================================================================
select is((select count(*)::int from public.events where session_id = pg_temp.sid('s1')), 9,
  'BR16: 9 payment changes in the pay-first session, 9 events');
select ok((select bool_and(actor is not null and created_at is not null and payload ? 'from' and payload ? 'to') from public.events),
  'Every event has an actor, a time, and from/to');
select results_eq(
  $$ select type, actor, payload ->> 'from', payload ->> 'to' from public.events
     where session_id = pg_temp.sid('s1') and payload ->> 'player_id' = current_setting('test.p1') order by created_at, id $$,
  $$ values
       ('payment_reference_submitted'::text, '77777777-0000-0000-0000-000000000001'::uuid, 'unpaid'::text, 'pending'::text),
       ('payment_reference_submitted', '77777777-0000-0000-0000-000000000001'::uuid, 'pending', 'pending'),
       ('payment_confirmed', '11111111-1111-1111-1111-111111111111'::uuid, 'pending', 'confirmed'),
       ('payment_undone', '11111111-1111-1111-1111-111111111111'::uuid, 'confirmed', 'unpaid') $$,
  'BR16: Ana''s history: submitted, corrected, confirmed by the owner, undone by the owner');
select ok((select payments.status = session_players.payment_status from public.payments join public.session_players on session_players.id = payments.session_player_id
           where payments.session_player_id = pg_temp.sid('p2')),
  'payments.status and session_players.payment_status stay in step');
select is((select count(*)::int from public.payments p join public.session_players sp on sp.id = p.session_player_id where p.status <> sp.payment_status), 0,
  'No payment row disagrees with its player''s payment_status');

-- ===========================================================================
-- NF14: a player never reads another player's reference
-- ===========================================================================
select pg_temp.as_player('77777777-0000-0000-0000-000000000003');
select is((select array_agg(session_player_id)::text from public.payments), array[pg_temp.sid('p3')]::text, 'A player reads only their own payment row');
select is((select reference_digits from public.payments where session_player_id = pg_temp.sid('p3')), '1234567890', 'including their own reference');
select is((select count(*)::int from public.payments where session_player_id = pg_temp.sid('w3')), 0, 'Another player''s payment is invisible');
select is((select count(*)::int from public.events), 0, 'Players read no events');
select is((select count(*)::int from public.session_players where session_id = pg_temp.sid('s1') and payment_status = 'pending'), 2,
  'Players can see others'' payment_status (it drives holds), but not their references');
select throws_ok($$ select updated_by from public.payments $$, '42501', null, 'updated_by is not readable');
select throws_ok($$ insert into public.payments (session_id, session_player_id, amount, status) values (pg_temp.sid('s1'), pg_temp.sid('p3'), 0, 'confirmed') $$,
  '42501', null, 'No direct insert into payments');
select throws_ok($$ update public.session_players set payment_status = 'confirmed' $$, '42501', null, 'No direct update of payment_status');
reset role;
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))
     and ('reference_digits' = any (coalesce(p.proargnames, '{}')) or p.prorettype = 'public.payments'::regtype)),
  0, 'NF14: no client-callable function returns references');

-- Staff read their session's payments; other clubs read none; anon none.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is((select count(*)::int from public.payments where session_id = pg_temp.sid('s1')), 5, 'The owner reads every payment of the session');
select ok((select count(*) > 0 from public.events where session_id = pg_temp.sid('s1')), 'The owner reads the events');
reset role;
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select is((select count(*)::int from public.payments), 0, 'Another club reads no payments');
select is((select count(*)::int from public.events), 0, 'Another club reads no events');
reset role;
set local role anon;
select throws_ok($$ select id from public.payments $$, '42501', null, 'anon cannot read payments');
select throws_ok($$ select id from public.events $$, '42501', null, 'anon cannot read events');
reset role;

-- ===========================================================================
-- fee 0: no payment step anywhere
-- ===========================================================================
select pg_temp.as_player('77777777-0000-0000-0000-000000000002');
select set_config('test.f1', public.join_session(current_setting('test.code0'), 'Free Ben', 'beginner', 'gcash', '123456')::text, true);
select is(pg_temp.err($$ select public.player_submit_reference(pg_temp.sid('f1'), '123456') $$), 'no_payment_needed', 'Fee 0: no reference to submit');
reset role;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select set_config('test.f2', public.add_walk_in(pg_temp.sid('s0'), 'Free Walk', 'beginner', 'cash_received')::text, true);
select is(pg_temp.err($$ select public.confirm_payment(pg_temp.sid('f1')) $$), 'no_payment_needed', 'Fee 0: nothing to confirm');
select is(public.session_eligible_count(pg_temp.sid('s0')), 2, 'Fee 0 with pay_first on: unpaid players are eligible');
reset role;
select is((select count(*)::int from public.payments where session_id = pg_temp.sid('s0')), 0, 'Fee 0: no payment rows');
select is((select count(*)::int from public.events where session_id = pg_temp.sid('s0')), 0, 'Fee 0: no payment events');
select results_eq($$ select fee, pay_first from public.checkin_preview(current_setting('test.code0')) $$, $$ values (0, true) $$,
  'checkin_preview tells the page the fee is 0');

-- checkin_preview: fee and GCash for live sessions only
update public.clubs set gcash_name = 'Juan', gcash_number = '09171234567' where id = 'cb000000-0000-0000-0000-000000000000';
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select set_config('test.sb', public.create_session('cb000000-0000-0000-0000-000000000000', 'Other Night', now(), now() + interval '3h', 1, p_pay_first => true, p_start => true)::text, true);
reset role;
select set_config('test.codeb', (select join_code from public.sessions where id = pg_temp.sid('sb')), true);
set local role anon;
select results_eq($$ select fee, pay_first, gcash_name, gcash_number from public.checkin_preview(current_setting('test.codeb')) $$,
  $$ values (150, true, 'Juan'::text, '09171234567'::text) $$, 'checkin_preview (anon) shows the fee, pay_first and the club''s GCash for a live session');
reset role;

-- Payments can be settled after the session ends.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select set_config('test.r1', (select id::text from public.session_players where session_id = pg_temp.sid('s2') and display_name = 'Relaxed 1'), true);
select public.end_session(pg_temp.sid('s2'));
select lives_ok($$ select public.confirm_payment(pg_temp.sid('r1')) $$, 'The owner can confirm a payment after the session ended');
reset role;
select is(pg_temp.pay(pg_temp.sid('r1')), 'cash|-|confirmed|150/confirmed', 'Settled after the end (player had left)');

select * from finish();
rollback;
