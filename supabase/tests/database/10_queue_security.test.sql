-- Phase 3 queue functions refuse other clubs' staff, anonymous sessions,
-- signed-out callers and sessions that aren't live.
-- Run: npm run test:db   (needs the local stack: npx supabase start)
begin;
select plan(46);

create function pg_temp.as_user(p_sub uuid, p_extra jsonb default '{}') returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    (jsonb_build_object('sub', p_sub, 'role', 'authenticated') || p_extra)::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;
create function pg_temp.sid(p_key text) returns uuid language sql as $$
  select current_setting('test.' || p_key)::uuid;
$$;

insert into auth.users (id, instance_id, aud, role, email, is_anonymous) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner.a@example.com', false),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner.b@example.com', false),
  ('77777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true);
insert into public.clubs (id, name, created_by) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Club A', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Club B', '22222222-2222-2222-2222-222222222222');
insert into public.club_staff (club_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'owner'),
  -- An anonymous session with a staff row anyway, to prove the functions check on their own.
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '77777777-7777-7777-7777-777777777777', 'organizer');

-- Club A: an ended session (with a court and a player), a draft, and a live
-- session with 6 walk-ins, a running game on Court 1 and a paused player.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select set_config('test.ended', public.create_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Old', now() - interval '1 day', now() - interval '21h', 1, p_start => true)::text, true);
select set_config('test.ended_player', public.add_walk_in(pg_temp.sid('ended'), 'Old Player', 'beginner', 'later')::text, true);
select public.end_session(pg_temp.sid('ended'));
select set_config('test.ended_court', (select id::text from public.courts where session_id = pg_temp.sid('ended')), true);
select set_config('test.draft', public.create_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Later', now() + interval '1 day', now() + interval '1 day 3h', 2)::text, true);
select set_config('test.live', public.create_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Now', now(), now() + interval '3h', 2, p_start => true)::text, true);
select public.add_walk_in(pg_temp.sid('live'), 'L' || n, 'beginner', 'later') from generate_series(1, 6) n;
select set_config('test.c1', (select id::text from public.courts where session_id = pg_temp.sid('live') and number = 1), true);
select set_config('test.c2', (select id::text from public.courts where session_id = pg_temp.sid('live') and number = 2), true);
select set_config('test.game', public.call_next(pg_temp.sid('c1'))::text, true);
select set_config('test.queued', (select id::text from public.session_players where display_name = 'L5'), true);
select set_config('test.paused', (select id::text from public.session_players where display_name = 'L6'), true);
select public.pause_player(pg_temp.sid('paused'));
reset role;

-- Snapshot of everything in Club A's live session, to prove refused calls change nothing.
create temporary table snap as
  select 'p' as kind, id::text || status || queue_pos || games_played as row from public.session_players where session_id = pg_temp.sid('live')
  union all select 'c', id::text || coalesce(current_game_id::text, '-') || winner_streak from public.courts where session_id = pg_temp.sid('live')
  union all select 'g', id::text || coalesce(ended_at::text, '-') from public.games where session_id = pg_temp.sid('live');
create function pg_temp.unchanged() returns boolean language sql as $$
  select not exists (
    (select * from snap)
    except
    (select 'p', id::text || status || queue_pos || games_played from public.session_players where session_id = pg_temp.sid('live')
     union all select 'c', id::text || coalesce(current_game_id::text, '-') || winner_streak from public.courts where session_id = pg_temp.sid('live')
     union all select 'g', id::text || coalesce(ended_at::text, '-') from public.games where session_id = pg_temp.sid('live')))
  and (select count(*) from public.session_players where session_id = pg_temp.sid('live')) = 6
  and (select count(*) from public.games where session_id = pg_temp.sid('live')) = 1;
$$;

-- ---------------------------------------------------------------------------
-- Owner of Club B: every function refused, as if the ids didn't exist
-- ---------------------------------------------------------------------------
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select throws_ok($$ select public.call_next(pg_temp.sid('c2')) $$, 'P0001', 'court_not_found', 'Other club: call_next refused');
select throws_ok($$ select public.finish_game(pg_temp.sid('c1'), pg_temp.sid('game')) $$, 'P0001', 'court_not_found', 'Other club: finish_game refused');
select throws_ok($$ select public.add_walk_in(pg_temp.sid('live'), 'Intruder', 'beginner', 'later') $$, 'P0001', 'session_not_found', 'Other club: add_walk_in refused');
select throws_ok($$ select public.pause_player(pg_temp.sid('queued')) $$, 'P0001', 'player_not_found', 'Other club: pause_player refused');
select throws_ok($$ select public.resume_player(pg_temp.sid('paused')) $$, 'P0001', 'player_not_found', 'Other club: resume_player refused');
select throws_ok($$ select public.remove_player(pg_temp.sid('queued')) $$, 'P0001', 'player_not_found', 'Other club: remove_player refused');
select throws_ok($$ select public.session_eligible_count(pg_temp.sid('live')) $$, 'P0001', 'session_not_found', 'Other club: session_eligible_count refused');
select throws_ok($$ select public.call_next('00000000-0000-0000-0000-000000000000') $$, 'P0001', 'court_not_found', 'Unknown court: same error');
select throws_ok($$ select public.pause_player('00000000-0000-0000-0000-000000000000') $$, 'P0001', 'player_not_found', 'Unknown player: same error');
select throws_ok($$ select public.end_session(pg_temp.sid('live')) $$, 'P0001', 'session_not_found', 'Other club: end_session refused');
reset role;
select ok(pg_temp.unchanged(), 'Club A''s live session is unchanged after Club B''s attempts');

-- ---------------------------------------------------------------------------
-- Anonymous (player) session, even with a staff row
-- ---------------------------------------------------------------------------
select pg_temp.as_user('77777777-7777-7777-7777-777777777777', '{"is_anonymous": true}');
select throws_ok($$ select public.call_next(pg_temp.sid('c2')) $$, '42501', 'not_organizer_account', 'Anonymous: call_next refused');
select throws_ok($$ select public.finish_game(pg_temp.sid('c1'), pg_temp.sid('game')) $$, '42501', 'not_organizer_account', 'Anonymous: finish_game refused');
select throws_ok($$ select public.add_walk_in(pg_temp.sid('live'), 'Sneaky', 'beginner', 'later') $$, '42501', 'not_organizer_account', 'Anonymous: add_walk_in refused');
select throws_ok($$ select public.pause_player(pg_temp.sid('queued')) $$, '42501', 'not_organizer_account', 'Anonymous: pause_player refused');
select throws_ok($$ select public.resume_player(pg_temp.sid('paused')) $$, '42501', 'not_organizer_account', 'Anonymous: resume_player refused');
select throws_ok($$ select public.remove_player(pg_temp.sid('queued')) $$, '42501', 'not_organizer_account', 'Anonymous: remove_player refused');
select throws_ok($$ select public.session_eligible_count(pg_temp.sid('live')) $$, '42501', 'not_organizer_account', 'Anonymous: session_eligible_count refused');
select throws_ok($$ select public.end_session(pg_temp.sid('live')) $$, '42501', 'not_organizer_account', 'Anonymous: end_session refused');
reset role;
select ok(pg_temp.unchanged(), 'Club A''s live session is unchanged after the anonymous attempts');

-- ---------------------------------------------------------------------------
-- No JWT, and the anon role
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '', true);
set local role authenticated;
select throws_ok($$ select public.call_next(pg_temp.sid('c2')) $$, '42501', 'not_authenticated', 'No JWT: call_next refused');
select throws_ok($$ select public.finish_game(pg_temp.sid('c1'), pg_temp.sid('game')) $$, '42501', 'not_authenticated', 'No JWT: finish_game refused');
select throws_ok($$ select public.add_walk_in(pg_temp.sid('live'), 'Nobody', 'beginner', 'later') $$, '42501', 'not_authenticated', 'No JWT: add_walk_in refused');
select throws_ok($$ select public.remove_player(pg_temp.sid('queued')) $$, '42501', 'not_authenticated', 'No JWT: remove_player refused');
reset role;
set local role anon;
select throws_ok($$ select public.call_next(pg_temp.sid('c2')) $$, '42501', null, 'anon role: call_next not executable');
select throws_ok($$ select public.finish_game(pg_temp.sid('c1'), pg_temp.sid('game')) $$, '42501', null, 'anon role: finish_game not executable');
select throws_ok($$ select public.add_walk_in(pg_temp.sid('live'), 'Nobody', 'beginner', 'later') $$, '42501', null, 'anon role: add_walk_in not executable');
select throws_ok($$ select public.pause_player(pg_temp.sid('queued')) $$, '42501', null, 'anon role: pause_player not executable');
reset role;
select ok(pg_temp.unchanged(), 'Club A''s live session is unchanged');

-- ---------------------------------------------------------------------------
-- Sessions that aren't live (draft, ended)
-- ---------------------------------------------------------------------------
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select throws_ok($$ select public.add_walk_in(pg_temp.sid('draft'), 'Early Bird', 'beginner', 'later') $$, 'P0001', 'session_not_live', 'Draft: add_walk_in refused');
select throws_ok($$ select public.add_walk_in(pg_temp.sid('ended'), 'Late Comer', 'beginner', 'later') $$, 'P0001', 'session_not_live', 'Ended: add_walk_in refused');
select throws_ok($$ select public.call_next(pg_temp.sid('ended_court')) $$, 'P0001', 'session_not_live', 'Ended: call_next refused');
select throws_ok($$ select public.finish_game(pg_temp.sid('ended_court'), pg_temp.sid('game')) $$, 'P0001', 'session_not_live', 'Ended: finish_game refused');
select throws_ok($$ select public.pause_player(pg_temp.sid('ended_player')) $$, 'P0001', 'session_not_live', 'Ended: pause_player refused');
select throws_ok($$ select public.resume_player(pg_temp.sid('ended_player')) $$, 'P0001', 'session_not_live', 'Ended: resume_player refused');
select throws_ok($$ select public.remove_player(pg_temp.sid('ended_player')) $$, 'P0001', 'session_not_live', 'Ended: remove_player refused');
select is((select count(*)::int from public.courts where session_id = pg_temp.sid('draft')), 0, 'A draft has no courts to call');
select is((select count(*)::int from public.session_players where session_id in (pg_temp.sid('draft'), pg_temp.sid('ended')) and status <> 'left'), 0,
  'Nothing was added to the draft or the ended session');
select is((select status from public.session_players where id = pg_temp.sid('ended_player')), 'left', 'Ended session players stay left');

-- ---------------------------------------------------------------------------
-- Control: the owner can do all of it on the live session
-- ---------------------------------------------------------------------------
select is(public.session_eligible_count(pg_temp.sid('live')), 1, 'Eligible: L5 only (L6 is paused)');
select throws_ok($$ select public.call_next(pg_temp.sid('c2')) $$, 'P0001', 'not_enough_players', 'Court 2 needs more players');
select lives_ok($$ select public.resume_player(pg_temp.sid('paused')) $$, 'Owner resumes L6');
select lives_ok($$ select public.add_walk_in(pg_temp.sid('live'), 'L7', 'advanced', 'later') $$, 'Owner adds L7');
select lives_ok($$ select public.add_walk_in(pg_temp.sid('live'), 'L8', 'advanced', 'later') $$, 'Owner adds L8');
select lives_ok($$ select public.call_next(pg_temp.sid('c2')) $$, 'Owner calls Court 2');
select lives_ok($$ select public.finish_game(pg_temp.sid('c1'), pg_temp.sid('game')) $$, 'Owner finishes game #1');
reset role;

select * from finish();
rollback;
