-- Phase 4 players: anonymous check-in, own-row-only actions (BR17, BR18),
-- not ready + swap (BR19), read isolation, checkin_preview, organizer refusals.
-- Run: npm run test:db   (needs the local stack: npx supabase start)
begin;
select plan(80);

create function pg_temp.as_user(p_sub uuid, p_extra jsonb default '{}') returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    (jsonb_build_object('sub', p_sub, 'role', 'authenticated') || p_extra)::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;
-- Anonymous player session (what supabase.auth.signInAnonymously gives).
create function pg_temp.as_player(p_sub uuid) returns void language sql as $$
  select pg_temp.as_user(p_sub, '{"is_anonymous": true}');
$$;
create function pg_temp.sid(p_key text) returns uuid language sql as $$
  select current_setting('test.' || p_key)::uuid;
$$;
create function pg_temp.err(p_sql text) returns text language plpgsql as $$
declare v_msg text; v_detail text;
begin
  execute p_sql;
  return 'no error';
exception when others then
  get stacked diagnostics v_msg = message_text, v_detail = pg_exception_detail;
  return v_msg || coalesce(':' || nullif(v_detail, ''), '');
end;
$$;
create function pg_temp.row_of(p_id uuid) returns text language sql as $$
  select status || '|' || queue_pos || '|' || coalesce(not_ready_at::text, '-') from public.session_players where id = p_id;
$$;
create function pg_temp.invariants_ok(p_session uuid) returns boolean language sql as $$
  select
    not exists (
      select x from public.games g, unnest(g.player_ids) x
      where g.session_id = p_session and g.ended_at is null group by x having count(*) > 1)
    and not exists (
      select 1 from public.games g cross join unnest(g.player_ids) x join public.session_players p on p.id = x
      where g.session_id = p_session and g.ended_at is null and p.status <> 'playing')
    and not exists (
      select 1 from public.session_players p
      where p.session_id = p_session and p.status = 'playing'
        and not exists (select 1 from public.games g where g.ended_at is null and p.id = any (g.player_ids)));
$$;

-- O owns Club A, B owns Club B, E owns Club E. P1, P2, P3 are anonymous players.
insert into auth.users (id, instance_id, aud, role, email, is_anonymous) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner.a@example.com', false),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner.b@example.com', false),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner.e@example.com', false),
  ('77777777-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true),
  ('77777777-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true),
  ('77777777-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true);
insert into public.clubs (id, name, created_by) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Club A', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Club B', '22222222-2222-2222-2222-222222222222'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Club E', '44444444-4444-4444-4444-444444444444');
insert into public.club_staff (club_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'owner'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '44444444-4444-4444-4444-444444444444', 'owner');

-- Club A: live session S (1 court) and a draft. Club B: live session T. Club E: an ended session.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select set_config('test.s', public.create_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Friday Open Play', '2026-11-27 18:00+08', '2026-11-27 21:00+08', 1, p_start => true)::text, true);
select set_config('test.draft', public.create_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Later Draft', now() + interval '1 day', now() + interval '1 day 3h', 2)::text, true);
reset role;
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select set_config('test.t', public.create_session('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Other Club Night', now(), now() + interval '3h', 1, p_start => true)::text, true);
select public.add_walk_in(pg_temp.sid('t'), 'Other Walk-in', 'beginner', 'later');
reset role;
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
select set_config('test.e', public.create_session('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Ended Night', now() - interval '1 day', now() - interval '21h', 1, p_start => true)::text, true);
select public.end_session(pg_temp.sid('e'));
reset role;

select set_config('test.code_s', (select join_code from public.sessions where id = pg_temp.sid('s')), true);
select set_config('test.code_t', (select join_code from public.sessions where id = pg_temp.sid('t')), true);
select set_config('test.code_e', (select join_code from public.sessions where id = pg_temp.sid('e')), true);
select set_config('test.code_draft', (select join_code from public.sessions where id = pg_temp.sid('draft')), true);
select set_config('test.court', (select id::text from public.courts where session_id = pg_temp.sid('s')), true);

-- ===========================================================================
-- checkin_preview: public, and leaks nothing for unknown / not-live codes
-- ===========================================================================
set local role anon;
select results_eq($$ select status, name, starts_at, ends_at, courts_count, waiting from public.checkin_preview(current_setting('test.code_s')) $$,
  $$ values ('live'::text, 'Friday Open Play'::text, '2026-11-27 18:00+08'::timestamptz, '2026-11-27 21:00+08'::timestamptz, 1, 0) $$,
  'checkin_preview (anon): a live session shows name, times, courts and 0 waiting');
select results_eq($$ select status, name, starts_at, ends_at, courts_count, waiting from public.checkin_preview(lower(current_setting('test.code_s'))) $$,
  $$ values ('live'::text, 'Friday Open Play'::text, '2026-11-27 18:00+08'::timestamptz, '2026-11-27 21:00+08'::timestamptz, 1, 0) $$,
  'checkin_preview ignores case');
select results_eq($$ select * from public.checkin_preview('ZZZZZZ') $$,
  $$ values ('not_found'::text, null::text, null::timestamptz, null::timestamptz, null::integer, null::integer, null::integer, null::boolean, null::text, null::text) $$,
  'Unknown code: only not_found');
select results_eq($$ select * from public.checkin_preview(current_setting('test.code_e')) $$,
  $$ values ('ended'::text, null::text, null::timestamptz, null::timestamptz, null::integer, null::integer, null::integer, null::boolean, null::text, null::text) $$,
  'Ended session: only its status');
select results_eq($$ select * from public.checkin_preview(current_setting('test.code_draft')) $$,
  $$ values ('draft'::text, null::text, null::timestamptz, null::timestamptz, null::integer, null::integer, null::integer, null::boolean, null::text, null::text) $$,
  'Draft session: only its status');
select is(
  (select array_agg(p.parameter_name::text order by p.ordinal_position) from information_schema.parameters p
   join information_schema.routines r on r.specific_name = p.specific_name
   where r.routine_schema = 'public' and r.routine_name = 'checkin_preview' and p.parameter_mode = 'OUT'),
  array['status', 'name', 'starts_at', 'ends_at', 'courts_count', 'waiting', 'fee', 'pay_first', 'gcash_name', 'gcash_number'],
  'checkin_preview returns exactly these columns (Phase 5 adds fee, pay_first, GCash)');
select throws_ok($$ select public.join_session(current_setting('test.code_s'), 'No Account') $$, '42501', null,
  'anon (not signed in) cannot join');
reset role;

-- ===========================================================================
-- join_session, rejoin, my_player
-- ===========================================================================
select pg_temp.as_player('77777777-0000-0000-0000-000000000001');
select set_config('test.p1', public.join_session(current_setting('test.code_s'), '  Tito   Boy ', 'advanced')::text, true);
select is(public.join_session(current_setting('test.code_s'), 'Someone Else'), pg_temp.sid('p1'), 'Joining again returns the same row');
select results_eq($$ select id, display_name, level, status, games_played, not_ready_at from public.my_player(pg_temp.sid('s')) $$,
  $$ values (pg_temp.sid('p1'), 'Tito Boy'::text, 'advanced'::text, 'queued'::text, 0, null::timestamptz) $$,
  'my_player returns the caller''s own row (name tidied)');
select is((select count(*)::int from public.my_player(pg_temp.sid('t'))), 0, 'my_player is empty for a session the caller is not in');
select is(pg_temp.err($$ select public.join_session('ZZZZZZ', 'Lost Player') $$), 'session_not_found', 'Unknown code: session_not_found');
select is(pg_temp.err($$ select public.join_session(current_setting('test.code_e'), 'Late Player') $$), 'checkin_closed', 'Ended session: checkin_closed');
select is(pg_temp.err($$ select public.join_session(current_setting('test.code_draft'), 'Early Player') $$), 'checkin_closed', 'Draft session: checkin_closed');
select throws_ok($$ select public.join_session(current_setting('test.code_t'), 'X', 'beginner') $$, '23514', null, 'Names need 2+ characters');
select throws_ok($$ select public.join_session(current_setting('test.code_t'), 'Valid Name', 'pro') $$, '23514', null, 'Unknown level refused');
reset role;
select results_eq($$ select user_id, is_walk_in, session_id from public.session_players where id = pg_temp.sid('p1') $$,
  $$ values ('77777777-0000-0000-0000-000000000001'::uuid, false, pg_temp.sid('s')) $$,
  'The row is tied to the anonymous user and is not a walk-in');
select is((select count(*)::int from public.session_players where user_id = '77777777-0000-0000-0000-000000000001'), 1, 'Still one row after re-joining');
select throws_ok($$ insert into public.session_players (session_id, display_name, user_id) values (pg_temp.sid('s'), 'Dup', '77777777-0000-0000-0000-000000000001') $$,
  '23505', null, 'The database allows one non-left row per user per session');

select set_config('request.jwt.claims', '', true);
set local role authenticated;
select throws_ok($$ select public.join_session(current_setting('test.code_s'), 'No JWT') $$, '42501', 'not_authenticated', 'No JWT: join refused');
reset role;

select pg_temp.as_player('77777777-0000-0000-0000-000000000002');
select set_config('test.p2', public.join_session(current_setting('test.code_s'), 'Ana')::text, true);
reset role;

-- ===========================================================================
-- Own row only (BR17/BR18 for players)
-- ===========================================================================
select set_config('test.p1_before', pg_temp.row_of(pg_temp.sid('p1')), true);
select pg_temp.as_player('77777777-0000-0000-0000-000000000002');
select is(pg_temp.err($$ select public.player_pause(pg_temp.sid('p1')) $$), 'player_not_found', 'P2 cannot pause P1');
select is(pg_temp.err($$ select public.player_leave(pg_temp.sid('p1')) $$), 'player_not_found', 'P2 cannot make P1 leave');
select is(pg_temp.err($$ select public.player_resume(pg_temp.sid('p1')) $$), 'player_not_found', 'P2 cannot resume P1');
select is(pg_temp.err($$ select public.player_not_ready(pg_temp.sid('p1')) $$), 'player_not_found', 'P2 cannot flag P1 as not ready');
reset role;
select is(pg_temp.row_of(pg_temp.sid('p1')), current_setting('test.p1_before'), 'P1''s row is unchanged');

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(pg_temp.err($$ select public.player_pause(pg_temp.sid('p1')) $$), 'player_not_found',
  'Even the organizer cannot use the player functions on someone else''s row');
reset role;

select pg_temp.as_player('77777777-0000-0000-0000-000000000001');
select lives_ok($$ select public.player_pause(pg_temp.sid('p1')) $$, 'BR17: P1 pauses');
select is(pg_temp.err($$ select public.player_pause(pg_temp.sid('p1')) $$), 'invalid_player_status', 'Cannot pause twice');
select is(pg_temp.err($$ select public.player_not_ready(pg_temp.sid('p1')) $$), 'invalid_player_status', 'BR19: not ready only while playing');
select lives_ok($$ select public.player_resume(pg_temp.sid('p1')) $$, 'BR17: P1 resumes');
reset role;
select is(pg_temp.row_of(pg_temp.sid('p1')), current_setting('test.p1_before'), 'BR17: same place after resuming');

-- BR18: leave, then check in again -> a new row at the end.
select pg_temp.as_player('77777777-0000-0000-0000-000000000001');
select lives_ok($$ select public.player_leave(pg_temp.sid('p1')) $$, 'BR18: P1 leaves');
select is((select count(*)::int from public.my_player(pg_temp.sid('s'))), 0, 'my_player is empty after leaving');
select is((select count(*)::int from public.session_players where session_id = pg_temp.sid('s')), 0,
  'A player who left cannot read the live session any more');
select is(pg_temp.err($$ select public.player_resume(pg_temp.sid('p1')) $$), 'invalid_player_status', 'A left row cannot be resumed');
select set_config('test.p1b', public.join_session(current_setting('test.code_s'), 'Tito Boy', 'advanced')::text, true);
select isnt(pg_temp.sid('p1b'), pg_temp.sid('p1'), 'BR18: checking in again makes a new row');
reset role;
select ok((select queue_pos from public.session_players where id = pg_temp.sid('p1b'))
          > (select max(queue_pos) from public.session_players where session_id = pg_temp.sid('s') and id <> pg_temp.sid('p1b')),
  'BR18: the new row is at the end of the queue');
select is((select status from public.session_players where id = pg_temp.sid('p1')), 'left', 'The old row stays left');

-- ===========================================================================
-- Read access for players
-- ===========================================================================
select pg_temp.as_player('77777777-0000-0000-0000-000000000001');
select is((select name from public.sessions where id = pg_temp.sid('s')), 'Friday Open Play', 'A player reads their session');
select is((select count(*)::int from public.courts where session_id = pg_temp.sid('s')), 1, 'A player reads their session''s courts');
select is((select array_agg(display_name order by queue_pos)::text from public.session_players where session_id = pg_temp.sid('s') and status <> 'left'),
  '{Ana,"Tito Boy"}', 'A player reads the waiting names in queue order');
select lives_ok($$ select id, display_name, level, status, queue_pos, games_played, not_ready_at from public.session_players $$,
  'A player reads the public player columns');
select throws_ok($$ select user_id from public.session_players $$, '42501', null, 'A player cannot read user_id');
select throws_ok($$ select device_id from public.session_players $$, '42501', null, 'A player cannot read device_id');
select throws_ok($$ select display_token from public.sessions $$, '42501', null, 'A player cannot read display_token');
select is((select count(*)::int from public.sessions where id <> pg_temp.sid('s')), 0, 'A player reads no other session');
select is((select count(*)::int from public.session_players where session_id <> pg_temp.sid('s')), 0, 'A player reads no other session''s players');
select is((select count(*)::int from public.courts where session_id <> pg_temp.sid('s')), 0, 'A player reads no other session''s courts');
select is((select count(*)::int from public.clubs), 0, 'A player reads no clubs');
select is((select count(*)::int from public.club_staff), 0, 'A player reads no staff');
select ok(public.is_session_player(pg_temp.sid('s')) and not public.is_session_player(pg_temp.sid('t')), 'is_session_player answers for the caller only');
reset role;

-- A player who never joined reads nothing.
select pg_temp.as_player('77777777-0000-0000-0000-000000000003');
select is((select count(*)::int from public.sessions), 0, 'Someone who never joined reads no sessions');
select is((select count(*)::int from public.session_players), 0, 'Someone who never joined reads no players');
reset role;

-- ===========================================================================
-- Organizer functions keep refusing anonymous callers
-- ===========================================================================
select pg_temp.as_player('77777777-0000-0000-0000-000000000001');
select is(pg_temp.err($$ select public.call_next(pg_temp.sid('court')) $$), 'not_organizer_account', 'Player: call_next refused');
select is(pg_temp.err($$ select public.add_walk_in(pg_temp.sid('s'), 'Friend', 'beginner', 'later') $$), 'not_organizer_account', 'Player: add_walk_in refused');
select is(pg_temp.err($$ select public.pause_player(pg_temp.sid('p2')) $$), 'not_organizer_account', 'Player: organizer pause refused');
select is(pg_temp.err($$ select public.swap_not_ready(pg_temp.sid('court'), pg_temp.sid('p2')) $$), 'not_organizer_account', 'Player: swap_not_ready refused');
select is(pg_temp.err($$ select public.end_session(pg_temp.sid('s')) $$), 'not_organizer_account', 'Player: end_session refused');
select is(pg_temp.err($$ select public.create_club('Player Club', null) $$), 'not_organizer_account', 'Player: create_club refused');
reset role;

-- ===========================================================================
-- BR19: not ready -> organizer swaps -> replaced player at the FRONT
-- ===========================================================================
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.add_walk_in(pg_temp.sid('s'), 'W' || n, 'beginner', 'later') from generate_series(1, 4) n;
-- Queue: Ana (P2), Tito Boy (P1b), W1, W2, W3, W4
select set_config('test.g1', public.call_next(pg_temp.sid('court'))::text, true);
reset role;
select set_config('test.w3', (select id::text from public.session_players where display_name = 'W3'), true);
select set_config('test.w4', (select id::text from public.session_players where display_name = 'W4'), true);

select pg_temp.as_player('77777777-0000-0000-0000-000000000002');
select lives_ok($$ select public.player_not_ready(pg_temp.sid('p2')) $$, 'BR19: Ana (playing) says she is not ready');
select ok((select not_ready_at is not null and status = 'playing' from public.my_player(pg_temp.sid('s'))),
  'BR19: flagged, still playing (the game does not change by itself)');
select is(pg_temp.err($$ select public.player_leave(pg_temp.sid('p2')) $$), 'invalid_player_status', 'A playing player cannot leave');
reset role;

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select is(pg_temp.err($$ select public.swap_not_ready(pg_temp.sid('court'), pg_temp.sid('p2')) $$), 'court_not_found', 'Another club''s owner cannot swap');
reset role;

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is((select not_ready_at is not null from public.session_players where id = pg_temp.sid('p2')), true, 'The organizer sees the flag');
select is(public.swap_not_ready(pg_temp.sid('court'), pg_temp.sid('p2')), pg_temp.sid('w3'), 'BR19: swap brings in the first eligible (W3)');
reset role;
select is((select player_ids from public.games where id = pg_temp.sid('g1')),
  array[pg_temp.sid('w3'), pg_temp.sid('p1b'),
        (select id from public.session_players where display_name = 'W1'), (select id from public.session_players where display_name = 'W2')],
  'BR19: W3 takes Ana''s place in the same game');
select results_eq($$ select status, not_ready_at from public.session_players where id = pg_temp.sid('p2') $$,
  $$ values ('queued'::text, null::timestamptz) $$, 'BR19: Ana is queued again, flag cleared');
select ok((select queue_pos from public.session_players where id = pg_temp.sid('p2'))
          < (select min(queue_pos) from public.session_players where session_id = pg_temp.sid('s') and status in ('queued', 'paused') and id <> pg_temp.sid('p2')),
  'BR19: Ana is at the FRONT of the queue');
select ok(pg_temp.invariants_ok(pg_temp.sid('s')), 'Nobody is on two courts or both playing and queued');
select is((select games_played from public.session_players where id = pg_temp.sid('p2')), 0, 'The swapped-out player''s games are unchanged');

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(pg_temp.err($$ select public.swap_not_ready(pg_temp.sid('court'), pg_temp.sid('p2')) $$), 'player_not_on_court',
  'Swapping someone who is not on the court is refused');

-- Nobody eligible: pause the two waiting (Ana, W4); Tito Boy flags; swap changes nothing.
select public.pause_player(pg_temp.sid('p2'));
select public.pause_player(pg_temp.sid('w4'));
reset role;
select pg_temp.as_player('77777777-0000-0000-0000-000000000001');
select lives_ok($$ select public.player_not_ready(pg_temp.sid('p1b')) $$, 'Tito Boy says not ready');
reset role;
create temporary table snap as
  select (select player_ids::text from public.games where id = pg_temp.sid('g1')) as game,
         (select string_agg(id || status || queue_pos || coalesce(not_ready_at::text, '-'), ';' order by id)
          from public.session_players where session_id = pg_temp.sid('s')) as players;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(pg_temp.err($$ select public.swap_not_ready(pg_temp.sid('court'), pg_temp.sid('p1b')) $$), 'not_enough_players:1',
  'BR19: with nobody eligible, swap raises not_enough_players');
reset role;
select is((select player_ids::text from public.games where id = pg_temp.sid('g1')), (select game from snap), 'No change to the game');
select is((select string_agg(id || status || queue_pos || coalesce(not_ready_at::text, '-'), ';' order by id)
           from public.session_players where session_id = pg_temp.sid('s')), (select players from snap), 'No change to any player');

-- Finishing the game clears the flag.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.resume_player(pg_temp.sid('p2'));
select public.finish_game(pg_temp.sid('court'), pg_temp.sid('g1'));
reset role;
select is((select count(*)::int from public.session_players where session_id = pg_temp.sid('s') and not_ready_at is not null), 0,
  'Not-ready flags are cleared when the game finishes');
select ok(pg_temp.invariants_ok(pg_temp.sid('s')), 'Invariants hold after the next call');

-- ===========================================================================
-- End of session: players can still see that it ended
-- ===========================================================================
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.end_session(pg_temp.sid('s'));
reset role;
select pg_temp.as_player('77777777-0000-0000-0000-000000000002');
select is((select status from public.sessions where id = pg_temp.sid('s')), 'ended', 'After the end, a player still sees the session status');
select is((select count(*)::int from public.my_player(pg_temp.sid('s'))), 0, 'my_player is empty (everyone left)');
select is(pg_temp.err($$ select public.player_resume(pg_temp.sid('p2')) $$), 'session_not_live', 'Player actions refuse an ended session');
select is((select count(*)::int from public.sessions where id <> pg_temp.sid('s')), 0, 'Still no other session');
reset role;

select * from finish();
rollback;
