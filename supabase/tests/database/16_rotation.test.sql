-- Pre-pilot: set_session_rotation (change All off / Winners stay while live).
-- Run: npm run test:db   (needs the local stack: npx supabase start)
begin;
select plan(30);

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
-- Read as postgres (RLS off).
create function pg_temp.rotation(p_session uuid) returns text language sql as $$
  select rotation from public.sessions where id = p_session;
$$;
create function pg_temp.streaks(p_session uuid) returns text language sql as $$
  select string_agg(winner_streak::text, ',' order by number) from public.courts where session_id = p_session;
$$;
create function pg_temp.rotation_events(p_session uuid) returns integer language sql as $$
  select count(*)::int from public.events where session_id = p_session and type = 'rotation_changed';
$$;

insert into auth.users (id, instance_id, aud, role, email, is_anonymous) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.com', false),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@example.com', false),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'organizer@example.com', false),
  ('77777777-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true);
insert into public.clubs (id, name, created_by) values
  ('c1000000-0000-0000-0000-000000000000', 'Rotation Club', '11111111-1111-1111-1111-111111111111'),
  ('c2000000-0000-0000-0000-000000000000', 'Other Club', '22222222-2222-2222-2222-222222222222'),
  ('c3000000-0000-0000-0000-000000000000', 'Draft Club', '11111111-1111-1111-1111-111111111111');
insert into public.club_staff (club_id, user_id, role) values
  ('c1000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('c1000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'organizer'),
  ('c2000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'owner'),
  ('c3000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'owner');

-- A live session (2 courts, All off), an ended one and a draft.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select set_config('test.live', public.create_session('c1000000-0000-0000-0000-000000000000', 'Live Night', now(), now() + interval '3h', 2, p_start => true)::text, true);
select set_config('test.ended', public.create_session('c3000000-0000-0000-0000-000000000000', 'Old Night', now() - interval '1 day', now() - interval '1 day' + interval '3h', 1, p_start => true)::text, true);
select public.end_session(pg_temp.sid('ended'));
select set_config('test.draft', public.create_session('c3000000-0000-0000-0000-000000000000', 'Next Night', now() + interval '1 day', now() + interval '1 day 3h', 1)::text, true);
reset role;

-- ===========================================================================
-- 1. Hardening: security definer, fixed search_path, callable by signed-in users only
-- ===========================================================================
select ok((select prosecdef from pg_proc where oid = 'public.set_session_rotation(uuid, text)'::regprocedure),
  'set_session_rotation is SECURITY DEFINER');
select ok((select array_to_string(proconfig, ',') from pg_proc where oid = 'public.set_session_rotation(uuid, text)'::regprocedure) = 'search_path=""',
  'It runs with an empty search_path');
select ok(not has_function_privilege('anon', 'public.set_session_rotation(uuid, text)', 'execute'), 'anon cannot execute it');
select ok(has_function_privilege('authenticated', 'public.set_session_rotation(uuid, text)', 'execute'), 'authenticated can execute it (the function checks the rest)');
select ok(not exists (
  select 1 from pg_proc p, aclexplode(p.proacl) a
  where p.oid = 'public.set_session_rotation(uuid, text)'::regprocedure and a.grantee = 0 and a.privilege_type = 'EXECUTE'),
  'PUBLIC has no execute grant');

-- ===========================================================================
-- 2. The owner switches All off -> Winners stay: streaks reset, event written
-- ===========================================================================
update public.courts set winner_streak = 1 where session_id = pg_temp.sid('live') and number = 1;
update public.courts set winner_streak = 2 where session_id = pg_temp.sid('live') and number = 2;
select is(pg_temp.streaks(pg_temp.sid('live')), '1,2', 'Setup: both courts have a winner streak');

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(pg_temp.err($$ select public.set_session_rotation(pg_temp.sid('live'), 'winners_stay') $$), 'no error', 'The owner can change the rotation while live');
reset role;
select is(pg_temp.rotation(pg_temp.sid('live')), 'winners_stay', 'The session is now Winners stay');
select is(pg_temp.streaks(pg_temp.sid('live')), '0,0', 'Every court''s winner streak is back to 0');
select is(pg_temp.rotation_events(pg_temp.sid('live')), 1, 'One rotation_changed event is written');
select is((select payload::text from public.events where session_id = pg_temp.sid('live') and type = 'rotation_changed'),
  '{"to": "winners_stay", "from": "all_off"}', 'The event says from and to');
select is((select actor from public.events where session_id = pg_temp.sid('live') and type = 'rotation_changed'),
  '11111111-1111-1111-1111-111111111111'::uuid, 'The event records who changed it');

-- Same mode again: nothing changes (safe to replay from the offline outbox).
update public.courts set winner_streak = 1 where session_id = pg_temp.sid('live') and number = 1;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(pg_temp.err($$ select public.set_session_rotation(pg_temp.sid('live'), 'winners_stay') $$), 'no error', 'Choosing the current mode again is accepted');
reset role;
select is(pg_temp.rotation_events(pg_temp.sid('live')), 1, 'It writes no second event');
select is(pg_temp.streaks(pg_temp.sid('live')), '1,0', 'And leaves the streaks alone (the mode didn''t change)');

-- A co-organizer (not the owner) can switch it back.
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select is(pg_temp.err($$ select public.set_session_rotation(pg_temp.sid('live'), 'all_off') $$), 'no error', 'A co-organizer of the club can change it');
reset role;
select is(pg_temp.rotation(pg_temp.sid('live')), 'all_off', 'Back to All off');
select is(pg_temp.streaks(pg_temp.sid('live')), '0,0', 'Streaks reset again');
select is(pg_temp.rotation_events(pg_temp.sid('live')), 2, 'A second event is written');

-- ===========================================================================
-- 3. Refused: other clubs, players, signed-out, draft/ended, bad values
-- ===========================================================================
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select is(pg_temp.err($$ select public.set_session_rotation(pg_temp.sid('live'), 'winners_stay') $$), 'session_not_found',
  'Another club''s owner gets not-found (ids can''t be probed)');
select pg_temp.as_player('77777777-0000-0000-0000-000000000001');
select is(pg_temp.err($$ select public.set_session_rotation(pg_temp.sid('live'), 'winners_stay') $$), '42501 not_organizer_account',
  'An anonymous player is refused');
select pg_temp.as_anon();
select is(pg_temp.err($$ select public.set_session_rotation(pg_temp.sid('live'), 'winners_stay') $$),
  '42501 permission denied for function set_session_rotation', 'Signed-out callers cannot call it');
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(pg_temp.err($$ select public.set_session_rotation(pg_temp.sid('draft'), 'winners_stay') $$), 'session_not_live', 'A draft is refused');
select is(pg_temp.err($$ select public.set_session_rotation(pg_temp.sid('ended'), 'winners_stay') $$), 'session_not_live', 'An ended session is refused');
select is(pg_temp.err($$ select public.set_session_rotation(pg_temp.sid('live'), 'king_of_the_court') $$), 'invalid_rotation', 'An unknown rotation is refused');
select is(pg_temp.err($$ select public.set_session_rotation(pg_temp.sid('live'), null) $$), 'invalid_rotation', 'A missing rotation is refused');
reset role;
select is(pg_temp.rotation(pg_temp.sid('live')) || '/' || pg_temp.rotation_events(pg_temp.sid('live')), 'all_off/2',
  'The refused calls changed nothing and wrote no event');
select is((select rotation from public.sessions where id = pg_temp.sid('draft')) || '/' || (select rotation from public.sessions where id = pg_temp.sid('ended')),
  'all_off/all_off', 'The draft and the ended session keep their rotation');

-- ===========================================================================
-- 4. Weakness check: the refusals above come from the function's own checks.
--    A copy without them lets the same calls through, so these tests would
--    catch a regression. (Everything is rolled back at the end.)
-- ===========================================================================
create or replace function public.set_session_rotation(p_session_id uuid, p_rotation text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.sessions set rotation = p_rotation where id = p_session_id;
end;
$$;
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select is(pg_temp.err($$ select public.set_session_rotation(pg_temp.sid('live'), 'winners_stay') $$), 'no error',
  'Weakened copy: another club could change it (the real one refuses: see above)');
select pg_temp.as_player('77777777-0000-0000-0000-000000000001');
select is(pg_temp.err($$ select public.set_session_rotation(pg_temp.sid('ended'), 'winners_stay') $$), 'no error',
  'Weakened copy: a player could change an ended session (the real one refuses)');
reset role;

select * from finish();
rollback;
