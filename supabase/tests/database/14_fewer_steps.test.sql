-- Phase 5b (D18): club entry codes and club_entry(), my_last_profile(), and
-- undo_last() for finish_game / remove_player / confirm_payment.
-- Run: npm run test:db   (needs the local stack: npx supabase start)
begin;
select plan(68);

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
create function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  perform set_config('role', 'anon', true);
end;
$$;
create function pg_temp.sid(p_key text) returns uuid language sql as $$
  select current_setting('test.' || p_key)::uuid;
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
-- Everything undo must restore, as one string (read as postgres).
create function pg_temp.state(p_session uuid) returns text language sql as $$
  select concat_ws(' / ',
    (select string_agg(concat_ws(':', display_name, status, queue_pos, games_played, coalesce(not_ready_at::text, '-'), payment_status),
                       ', ' order by display_name)
     from public.session_players where session_id = p_session),
    (select string_agg(concat_ws(':', c.label, coalesce(c.current_game_id::text, 'empty'), c.winner_streak), ', ' order by c.number)
     from public.courts c where c.session_id = p_session),
    (select string_agg(concat_ws(':', g.id, g.number, coalesce(g.ended_at::text, 'running'), coalesce(g.winner_ids::text, '-'), g.player_ids::text),
                       ', ' order by g.number)
     from public.games g where g.session_id = p_session),
    (select string_agg(concat_ws('|', coalesce(method, '-'), coalesce(reference_digits, '-'), status, amount), ', ' order by session_player_id)
     from public.payments where session_id = p_session)
  );
$$;
create function pg_temp.player(p_session uuid, p_name text) returns uuid language sql as $$
  select id from public.session_players where session_id = p_session and display_name = p_name and status <> 'left';
$$;
create function pg_temp.running_game(p_session uuid) returns uuid language sql as $$
  select current_game_id from public.courts where session_id = p_session and number = 1;
$$;
create function pg_temp.court1(p_session uuid) returns uuid language sql as $$
  select id from public.courts where session_id = p_session and number = 1;
$$;
-- Shifts the session's events (keeping their order) so the latest is this many seconds old.
create function pg_temp.age_last_event(p_session uuid, p_seconds integer) returns void language sql as $$
  update public.events
  set created_at = created_at - ((select max(e.created_at) from public.events e where e.session_id = p_session)
                                 - (clock_timestamp() - make_interval(secs => p_seconds)))
  where session_id = p_session;
$$;

insert into auth.users (id, instance_id, aud, role, email, is_anonymous) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.com', false),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@example.com', false),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'organizer@example.com', false),
  ('77777777-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true),
  ('77777777-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true),
  ('77777777-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true);
insert into public.clubs (id, name, created_by) values
  ('ca000000-0000-0000-0000-000000000000', 'Entry Club', '11111111-1111-1111-1111-111111111111'),
  ('cb000000-0000-0000-0000-000000000000', 'Other Club', '22222222-2222-2222-2222-222222222222'),
  ('cc000000-0000-0000-0000-000000000000', 'Undo Club', '11111111-1111-1111-1111-111111111111'),
  ('cd000000-0000-0000-0000-000000000000', 'Winners Club', '11111111-1111-1111-1111-111111111111');
insert into public.club_staff (club_id, user_id, role) values
  ('ca000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('ca000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'organizer'),
  ('cb000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'owner'),
  ('cc000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('cc000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'organizer'),
  ('cd000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'owner');

-- ===========================================================================
-- 1. Entry codes: every club has one (backfill + default), unique, client-proof
-- ===========================================================================
select col_not_null('public', 'clubs', 'entry_code', 'clubs.entry_code is required');
select col_has_default('public', 'clubs', 'entry_code', 'New clubs get an entry code by default');
select is((select count(*)::int from public.clubs where entry_code is null or entry_code !~ '^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$'), 0,
  'Every club (existing ones backfilled) has a 6-character no-look-alike code');
select is((select count(distinct entry_code)::int from public.clubs), (select count(*)::int from public.clubs),
  'No two clubs share an entry code');
select throws_ok(
  $$update public.clubs set entry_code = (select entry_code from public.clubs where id = 'cb000000-0000-0000-0000-000000000000')
    where id = 'ca000000-0000-0000-0000-000000000000'$$,
  '23505', null, 'A duplicate entry code is refused by the database');
select throws_ok($$update public.clubs set entry_code = 'ABC10O' where id = 'ca000000-0000-0000-0000-000000000000'$$,
  '23514', null, 'Look-alike characters are refused');

select set_config('test.entry_a', (select entry_code from public.clubs where id = 'ca000000-0000-0000-0000-000000000000'), true);

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(pg_temp.err($$update public.clubs set entry_code = 'AAAAAA' where id = 'ca000000-0000-0000-0000-000000000000'$$),
  '42501 permission denied for table clubs', 'Even the owner cannot set entry_code directly');
select is((select entry_code from public.clubs where id = 'ca000000-0000-0000-0000-000000000000'), current_setting('test.entry_a'),
  'Staff can read their club''s entry code');
reset role;

-- Regeneration: owner only.
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select is(pg_temp.err($$select public.regenerate_entry_code('ca000000-0000-0000-0000-000000000000')$$),
  '42501 not_owner', 'An organizer (not owner) cannot change the club QR');
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select is(pg_temp.err($$select public.regenerate_entry_code('ca000000-0000-0000-0000-000000000000')$$),
  '42501 not_owner', 'Another club''s owner cannot change it');
select pg_temp.as_player('77777777-0000-0000-0000-000000000001');
select is(pg_temp.err($$select public.regenerate_entry_code('ca000000-0000-0000-0000-000000000000')$$),
  '42501 not_organizer_account', 'Anonymous players cannot change it');
select pg_temp.as_anon();
select is(pg_temp.err($$select public.regenerate_entry_code('ca000000-0000-0000-0000-000000000000')$$),
  '42501 permission denied for function regenerate_entry_code', 'Signed-out callers cannot call it');
reset role;
select is((select entry_code from public.clubs where id = 'ca000000-0000-0000-0000-000000000000'), current_setting('test.entry_a'),
  'The refused calls changed nothing');

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select set_config('test.entry_a2', public.regenerate_entry_code('ca000000-0000-0000-0000-000000000000'), true);
reset role;
select isnt(current_setting('test.entry_a2'), current_setting('test.entry_a'), 'The owner gets a new code');
select is((select entry_code from public.clubs where id = 'ca000000-0000-0000-0000-000000000000'), current_setting('test.entry_a2'),
  'The new code is saved');
select ok(current_setting('test.entry_a2') ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$', 'The new code uses the same alphabet');

-- ===========================================================================
-- 2. club_entry: status, join code and club name only
-- ===========================================================================
select is(pg_get_function_result('public.club_entry(text)'::regprocedure),
  'TABLE(status text, join_code text, club_name text)', 'club_entry returns only status, join_code and club_name');

select pg_temp.as_anon();
select is((select row(status, join_code, club_name)::text from public.club_entry(current_setting('test.entry_a'))),
  '(not_found,,)', 'The old code no longer works after Palitan');
select is((select row(status, join_code, club_name)::text from public.club_entry('ZZZZZZ')),
  '(not_found,,)', 'Unknown code: not_found and nothing else');
select is((select row(status, join_code, club_name)::text from public.club_entry(current_setting('test.entry_a2'))),
  '(none,,"Entry Club")', 'No live session: none and the club name (anon can call it)');
reset role;

-- A draft and an ended session still count as "none".
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select set_config('test.sa1', public.create_session('ca000000-0000-0000-0000-000000000000', 'Old Night', now() - interval '8 days', now() - interval '8 days' + interval '3h', 1, p_start => true)::text, true);
select public.end_session(pg_temp.sid('sa1'));
select set_config('test.sa2', public.create_session('ca000000-0000-0000-0000-000000000000', 'Last Night', now() - interval '1 day', now() - interval '1 day' + interval '3h', 1, p_start => true)::text, true);
select public.end_session(pg_temp.sid('sa2'));
select public.create_session('ca000000-0000-0000-0000-000000000000', 'Draft Night', now() + interval '1 day', now() + interval '1 day 3h', 1);
reset role;
select is((select status from public.club_entry(current_setting('test.entry_a2'))), 'none', 'Drafts and ended sessions are not "live"');

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select set_config('test.sa3', public.create_session('ca000000-0000-0000-0000-000000000000', 'Tonight', now(), now() + interval '3h', 1, p_start => true)::text, true);
reset role;
select set_config('test.code_a3', (select join_code from public.sessions where id = pg_temp.sid('sa3')), true);

select pg_temp.as_player('77777777-0000-0000-0000-000000000001');
select is((select row(status, join_code, club_name)::text from public.club_entry(lower(' ' || current_setting('test.entry_a2') || ' '))),
  format('(live,%s,"Entry Club")', current_setting('test.code_a3')), 'Live: the live session''s join code (code is case- and space-tolerant)');
reset role;

-- ===========================================================================
-- 3. my_last_profile: the caller's own latest row in the same club
-- ===========================================================================
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select set_config('test.sx', public.create_session('cb000000-0000-0000-0000-000000000000', 'Elsewhere', now(), now() + interval '3h', 1, p_start => true)::text, true);
reset role;

insert into public.session_players (session_id, display_name, level, user_id, status, created_at) values
  (pg_temp.sid('sa1'), 'Ana Old', 'beginner', '77777777-0000-0000-0000-000000000001', 'left', now() - interval '8 days'),
  (pg_temp.sid('sa2'), 'Ana Dela Cruz', 'advanced', '77777777-0000-0000-0000-000000000001', 'left', now() - interval '1 day'),
  (pg_temp.sid('sa2'), 'Ben Santos', 'intermediate', '77777777-0000-0000-0000-000000000002', 'left', now() - interval '1 day'),
  -- Newer, but in another club.
  (pg_temp.sid('sx'), 'Ana Elsewhere', 'unsure', '77777777-0000-0000-0000-000000000001', 'queued', now()),
  (pg_temp.sid('sx'), 'Cara Elsewhere', 'beginner', '77777777-0000-0000-0000-000000000003', 'queued', now());

select is(pg_get_function_result('public.my_last_profile(text)'::regprocedure),
  'TABLE(display_name text, level text)', 'my_last_profile returns only a name and a level');

select pg_temp.as_player('77777777-0000-0000-0000-000000000001');
select is((select row(display_name, level)::text from public.my_last_profile(current_setting('test.code_a3'))),
  '("Ana Dela Cruz",advanced)', 'Ana gets her most recent row in this club (not the newer one elsewhere)');
select is((select count(*)::int from public.my_last_profile('ZZZZZZ')), 0, 'Unknown join code: nothing');
select pg_temp.as_player('77777777-0000-0000-0000-000000000002');
select is((select row(display_name, level)::text from public.my_last_profile(current_setting('test.code_a3'))),
  '("Ben Santos",intermediate)', 'Ben gets his own row, never Ana''s');
select pg_temp.as_player('77777777-0000-0000-0000-000000000003');
select is((select count(*)::int from public.my_last_profile(current_setting('test.code_a3'))), 0,
  'Cara played only at another club: nothing');
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is((select count(*)::int from public.my_last_profile(current_setting('test.code_a3'))), 0,
  'The organizer has no player rows: nothing (staff get no one else''s data)');
select pg_temp.as_anon();
select is(pg_temp.err($$select * from public.my_last_profile('ABCDEF')$$),
  '42501 permission denied for function my_last_profile', 'Signed-out callers cannot call it');
reset role;

-- ===========================================================================
-- 4. undo_last
-- ===========================================================================
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select set_config('test.su', public.create_session('cc000000-0000-0000-0000-000000000000', 'Undo Night', now(), now() + interval '3h', 1, p_fee => 150, p_start => true)::text, true);
select public.add_walk_in(pg_temp.sid('su'), n, 'unsure') from unnest(array['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7']) n;
select public.call_next(pg_temp.court1(pg_temp.sid('su')));
reset role;

-- Nothing to undo yet (the only events are none; walk-ins chose no payment).
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(pg_temp.err(format('select public.undo_last(%L)', pg_temp.sid('su'))), 'undo_not_available', 'No undoable action yet');
reset role;

-- A not-ready flag on court and a pause in the queue, so the snapshot has both.
update public.session_players set not_ready_at = now() - interval '1 minute' where id = pg_temp.player(pg_temp.sid('su'), 'P2');
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.pause_player(pg_temp.player(pg_temp.sid('su'), 'P6'));
reset role;

-- 4a. finish_game (all off): the game reopens, the next game is gone, everyone is back.
select set_config('test.before', pg_temp.state(pg_temp.sid('su')), true);
select set_config('test.g1', pg_temp.running_game(pg_temp.sid('su'))::text, true);
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select set_config('test.g2', public.finish_game(pg_temp.court1(pg_temp.sid('su')), pg_temp.sid('g1'))::text, true);
reset role;
select isnt(pg_temp.state(pg_temp.sid('su')), current_setting('test.before'), 'finish_game changed the session');
select is((select (payload ? 'undo') and (payload ? 'change') and actor = '11111111-1111-1111-1111-111111111111'
           from public.events where session_id = pg_temp.sid('su') and type = 'game_finished'), true,
  'finish_game records who did it and a restore snapshot in events');

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(public.undo_last(pg_temp.sid('su')), 'game_finished', 'undo_last reports what it undid');
reset role;
select is(pg_temp.state(pg_temp.sid('su')), current_setting('test.before'),
  'Exact state back: game reopened, next game removed, status, queue_pos, games_played, not-ready, court and streak');
select is((select count(*)::int from public.games where id = pg_temp.sid('g2')), 0, 'The next game no longer exists');
select is((select row(type, actor, payload ->> 'undone_type')::text from public.events where session_id = pg_temp.sid('su')
           order by created_at desc, id desc limit 1),
  '(undo,11111111-1111-1111-1111-111111111111,game_finished)', 'The undo itself is recorded');

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(pg_temp.err(format('select public.undo_last(%L)', pg_temp.sid('su'))), 'undo_not_available', 'The same action cannot be undone twice');

-- The game can be finished again normally after the undo.
select isnt(public.finish_game(pg_temp.court1(pg_temp.sid('su')), pg_temp.sid('g1')), null, 'The reopened game finishes as usual');
select public.undo_last(pg_temp.sid('su'));
reset role;
select is(pg_temp.state(pg_temp.sid('su')), current_setting('test.before'), 'Undo works again for the new finish');

-- 4b. 30 seconds
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.finish_game(pg_temp.court1(pg_temp.sid('su')), pg_temp.sid('g1'));
reset role;
select pg_temp.age_last_event(pg_temp.sid('su'), 31);
select set_config('test.after_finish', pg_temp.state(pg_temp.sid('su')), true);
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(pg_temp.err(format('select public.undo_last(%L)', pg_temp.sid('su'))), 'undo_not_available', 'Refused after 30 seconds');
reset role;
select is(pg_temp.state(pg_temp.sid('su')), current_setting('test.after_finish'), 'A refused undo changes nothing');
select pg_temp.age_last_event(pg_temp.sid('su'), 28);
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(public.undo_last(pg_temp.sid('su')), 'game_finished', 'Allowed at 28 seconds');
reset role;
select is(pg_temp.state(pg_temp.sid('su')), current_setting('test.before'), 'and restores the state');

-- 4c. Another change since: with an event (pause) and without one (a walk-in, no payment event).
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.finish_game(pg_temp.court1(pg_temp.sid('su')), pg_temp.sid('g1'));
select public.add_walk_in(pg_temp.sid('su'), 'P8', 'unsure');
select is(pg_temp.err(format('select public.undo_last(%L)', pg_temp.sid('su'))), 'undo_not_available',
  'Refused after another change that wrote no event (a walk-in)');
reset role;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
-- An undoable removal, then a phone check-in (no event either).
select public.remove_player(pg_temp.player(pg_temp.sid('su'), 'P8'));
reset role;
select set_config('test.code_u', (select join_code from public.sessions where id = pg_temp.sid('su')), true);
select pg_temp.as_player('77777777-0000-0000-0000-000000000001');
select public.join_session(current_setting('test.code_u'), 'Phone Pia', 'unsure');
reset role;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(pg_temp.err(format('select public.undo_last(%L)', pg_temp.sid('su'))), 'undo_not_available',
  'Refused after a player checked in from their phone');
reset role;

-- 4d. remove_player: back in the same place, with the same status.
select set_config('test.before_remove', pg_temp.state(pg_temp.sid('su')), true);
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.remove_player(pg_temp.player(pg_temp.sid('su'), 'P6'));
reset role;
select is((select status from public.session_players where session_id = pg_temp.sid('su') and display_name = 'P6'), 'left', 'P6 was removed');
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(public.undo_last(pg_temp.sid('su')), 'player_removed', 'undo_last undoes the removal');
reset role;
select is(pg_temp.state(pg_temp.sid('su')), current_setting('test.before_remove'), 'P6 is back: paused, same queue_pos');

-- 4e. confirm_payment: back to the previous status, method and reference.
select set_config('test.p3', pg_temp.player(pg_temp.sid('su'), 'P3')::text, true);
select set_config('test.before_cash', pg_temp.state(pg_temp.sid('su')), true);
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.confirm_payment(pg_temp.sid('p3'));
reset role;
select is((select payment_status from public.session_players where id = pg_temp.sid('p3')), 'confirmed', 'P3 paid cash');
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(public.undo_last(pg_temp.sid('su')), 'payment_confirmed', 'undo_last undoes the confirmation');
reset role;
select is((select row(p.status, p.method, p.reference_digits, p.amount, sp.payment_status)::text
           from public.payments p join public.session_players sp on sp.id = p.session_player_id where sp.id = pg_temp.sid('p3')),
  '(unpaid,,,150,unpaid)', 'P3 is unpaid again, with no method and no reference');

select pg_temp.as_player('77777777-0000-0000-0000-000000000001');
select public.player_submit_reference(pg_temp.player(pg_temp.sid('su'), 'Phone Pia'), '1234 5678 90');
reset role;
select set_config('test.before_gcash', pg_temp.state(pg_temp.sid('su')), true);
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.confirm_payment(pg_temp.player(pg_temp.sid('su'), 'Phone Pia'));
select public.undo_last(pg_temp.sid('su'));
reset role;
select is(pg_temp.state(pg_temp.sid('su')), current_setting('test.before_gcash'), 'A GCash confirmation goes back to pending with its reference');
select is((select row(p.status, p.method, p.reference_digits)::text from public.payments p
           where p.session_player_id = pg_temp.player(pg_temp.sid('su'), 'Phone Pia')),
  '(pending,gcash,1234567890)', 'Pia: pending, gcash, same reference');

-- Payment changes that aren't confirm_payment are not undoable.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.confirm_payment(pg_temp.sid('p3'));
select public.undo_payment(pg_temp.sid('p3'));
select is(pg_temp.err(format('select public.undo_last(%L)', pg_temp.sid('su'))), 'undo_not_available',
  'The latest action (undo_payment) is not undoable, so nothing is');
select public.add_walk_in(pg_temp.sid('su'), 'Paid Walk', 'unsure', 'cash_received');
select is(pg_temp.err(format('select public.undo_last(%L)', pg_temp.sid('su'))), 'undo_not_available',
  'A walk-in''s cash at check-in is not a confirm_payment');
reset role;

-- 4f. Who may undo.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.finish_game(pg_temp.court1(pg_temp.sid('su')), pg_temp.running_game(pg_temp.sid('su')));
reset role;
select set_config('test.after_finish2', pg_temp.state(pg_temp.sid('su')), true);
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select is(pg_temp.err(format('select public.undo_last(%L)', pg_temp.sid('su'))), 'session_not_found', 'Another club''s staff cannot undo');
select pg_temp.as_player('77777777-0000-0000-0000-000000000001');
select is(pg_temp.err(format('select public.undo_last(%L)', pg_temp.sid('su'))), '42501 not_organizer_account',
  'A player (anonymous sign-in) cannot undo, even a player of this session');
select pg_temp.as_anon();
select is(pg_temp.err(format('select public.undo_last(%L)', pg_temp.sid('su'))), '42501 permission denied for function undo_last',
  'Signed-out callers cannot call it');
reset role;
select is(pg_temp.state(pg_temp.sid('su')), current_setting('test.after_finish2'), 'Refused callers changed nothing');
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select is(public.undo_last(pg_temp.sid('su')), 'game_finished', 'A co-organizer of the club can undo');
reset role;

-- 4g. Winners stay: the streak and the winners' second game come back exactly.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select set_config('test.sw', public.create_session('cd000000-0000-0000-0000-000000000000', 'Winners Night', now(), now() + interval '3h', 1, p_rotation => 'winners_stay', p_start => true)::text, true);
select public.add_walk_in(pg_temp.sid('sw'), n, 'unsure') from unnest(array['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8']) n;
select public.call_next(pg_temp.court1(pg_temp.sid('sw')));
select public.finish_game(pg_temp.court1(pg_temp.sid('sw')), pg_temp.running_game(pg_temp.sid('sw')),
  array[pg_temp.player(pg_temp.sid('sw'), 'W1'), pg_temp.player(pg_temp.sid('sw'), 'W2')]);
reset role;
select is((select winner_streak from public.courts where id = pg_temp.court1(pg_temp.sid('sw'))), 1, 'W1 and W2 stay (streak 1)');
select set_config('test.before_w2', pg_temp.state(pg_temp.sid('sw')), true);
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.finish_game(pg_temp.court1(pg_temp.sid('sw')), pg_temp.running_game(pg_temp.sid('sw')),
  array[pg_temp.player(pg_temp.sid('sw'), 'W1'), pg_temp.player(pg_temp.sid('sw'), 'W2')]);
reset role;
select is((select winner_streak from public.courts where id = pg_temp.court1(pg_temp.sid('sw'))), 0, 'Second win: everyone off, streak 0');
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(public.undo_last(pg_temp.sid('sw')), 'game_finished', 'undo_last in winners stay');
reset role;
select is(pg_temp.state(pg_temp.sid('sw')), current_setting('test.before_w2'), 'Streak 1, winners'' game running, queue exactly as before');

-- 4h. Draft and ended sessions.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select set_config('test.sd', public.create_session('cc000000-0000-0000-0000-000000000000', 'Later Night', now() + interval '1 day', now() + interval '1 day 3h', 1)::text, true);
select is(pg_temp.err(format('select public.undo_last(%L)', pg_temp.sid('sd'))), 'undo_not_available', 'Nothing to undo in a draft');
select public.finish_game(pg_temp.court1(pg_temp.sid('su')), pg_temp.running_game(pg_temp.sid('su')));
select public.end_session(pg_temp.sid('su'));
select is(pg_temp.err(format('select public.undo_last(%L)', pg_temp.sid('su'))), 'undo_not_available',
  'Ending the session is a change: the last game cannot be undone');
-- Payments can still be settled (and undone) after the session ends.
select public.confirm_payment(pg_temp.sid('p3'));
select is(public.undo_last(pg_temp.sid('su')), 'payment_confirmed', 'A confirmation after the session ended can be undone');
select is((select payment_status from public.session_players where id = pg_temp.sid('p3')), 'unpaid', 'P3 is unpaid again');
reset role;

select * from finish();
rollback;
