-- Phase 9 / D25 part 1: level 1-5 (skill) kept in sync with the old text
-- level, so the deployed app keeps working; the organizer changes a level.
-- Run: npm run test:db   (needs the local stack: npx supabase start)
begin;
select plan(20);

create function pg_temp.as_user(p_sub uuid, p_extra jsonb default '{}') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', (jsonb_build_object('sub', p_sub, 'role', 'authenticated') || p_extra)::text, true);
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
create function pg_temp.pid(p_name text) returns uuid language sql as $$
  select id from public.session_players where session_id = pg_temp.sid('s') and display_name = p_name;
$$;
create function pg_temp.lv(p_name text) returns text language sql as $$
  select level || '/' || coalesce(skill::text, '-') from public.session_players where session_id = pg_temp.sid('s') and display_name = p_name;
$$;

insert into auth.users (id, instance_id, aud, role, email, is_anonymous) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.com', false),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@example.com', false),
  ('77777777-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true);
insert into public.clubs (id, name, created_by) values ('c9100000-0000-0000-0000-000000000000', 'Level Club', '11111111-1111-1111-1111-111111111111');
insert into public.club_staff (club_id, user_id, role) values ('c9100000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'owner');

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select set_config('test.s', public.create_session('c9100000-0000-0000-0000-000000000000', 'Level Night', now(), now() + interval '3h', 1, p_fee => 0, p_start => true)::text, true);
-- The deployed app's text levels, and the new app's digits, through the same RPC.
select public.add_walk_in(pg_temp.sid('s'), 'Old Beginner', 'beginner');
select public.add_walk_in(pg_temp.sid('s'), 'Old Inter', 'intermediate');
select public.add_walk_in(pg_temp.sid('s'), 'Old Adv', 'advanced');
select public.add_walk_in(pg_temp.sid('s'), 'Old Unsure', 'unsure');
select public.add_walk_in(pg_temp.sid('s'), 'New Five', '5');
select public.add_walk_in(pg_temp.sid('s'), 'New One', '1');
reset role;

select is(pg_temp.lv('Old Beginner'), 'beginner/2', 'beginner -> 2');
select is(pg_temp.lv('Old Inter'), 'intermediate/3', 'intermediate -> 3');
select is(pg_temp.lv('Old Adv'), 'advanced/4', 'advanced -> 4');
select is(pg_temp.lv('Old Unsure'), 'unsure/-', 'unsure -> not set');
select is(pg_temp.lv('New Five'), 'advanced/5', '"5" -> 5 (text kept for the deployed app: advanced)');
select is(pg_temp.lv('New One'), 'beginner/1', '"1" -> 1 (beginner)');
select ok(pg_temp.err($$ select public.add_walk_in(pg_temp.sid('s'), 'Bad Six', '6') $$) like '23514%', 'An unknown value ("6") is still refused by the check constraint');
select ok(pg_temp.err($$ select public.add_walk_in(pg_temp.sid('s'), 'Bad Pro', 'pro') $$) like '23514%', 'An unknown word ("pro") is still refused');

-- A phone check-in with the deployed app's level text.
select set_config('test.code', (select join_code from public.sessions where id = pg_temp.sid('s')), true);
select pg_temp.as_user('77777777-0000-0000-0000-000000000001', '{"is_anonymous": true}');
select public.join_session(current_setting('test.code'), 'Phone Pia', 'intermediate');
reset role;
select is(pg_temp.lv('Phone Pia'), 'intermediate/3', 'join_session maps the old text too');

-- The organizer changes a level; the member record follows.
insert into public.members (id, club_id, display_name, level) values ('a9100000-0000-0000-0000-000000000001', 'c9100000-0000-0000-0000-000000000000', 'Old Inter', 'intermediate');
update public.session_players set member_id = 'a9100000-0000-0000-0000-000000000001' where id = pg_temp.pid('Old Inter');
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(pg_temp.err($$ select public.set_player_level(pg_temp.pid('Old Inter'), 5) $$), 'no error', 'Organizer sets level 5');
reset role;
select is(pg_temp.lv('Old Inter'), 'advanced/5', 'Player is now 5 (text advanced)');
select is((select skill from public.members where id = 'a9100000-0000-0000-0000-000000000001'), 5::smallint, 'The member record remembers 5');
select is((select payload::text from public.events where session_id = pg_temp.sid('s') and type = 'level_changed'), '{"to": 5, "from": 3, "player_id": "' || pg_temp.pid('Old Inter') || '"}', 'A level_changed event with from/to');
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(pg_temp.err($$ select public.set_player_level(pg_temp.pid('Old Inter'), null) $$), 'no error', 'Clearing the level (not set)');
select is(pg_temp.err($$ select public.set_player_level(pg_temp.pid('Old Adv'), 6) $$), 'invalid_level', 'Level 6 is refused');
reset role;
select is(pg_temp.lv('Old Inter'), 'unsure/-', 'Cleared: unsure / not set');

-- Access: another organizer and a player can't change levels.
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select ok(pg_temp.err($$ select public.set_player_level(pg_temp.pid('Old Adv'), 2) $$) <> 'no error', 'Another club''s organizer is refused');
reset role;
select pg_temp.as_user('77777777-0000-0000-0000-000000000001', '{"is_anonymous": true}');
select is(pg_temp.err($$ select public.set_player_level(pg_temp.pid('Old Adv'), 2) $$), '42501 not_organizer_account', 'A player is refused');
-- my_last_profile_v2 returns the number for the next check-in.
select is((select skill from public.my_last_profile_v2(current_setting('test.code'))), 3::smallint, 'my_last_profile_v2 gives the player''s level as a number');
reset role;

-- Members written directly (the members form) with a digit.
insert into public.members (club_id, display_name, level) values ('c9100000-0000-0000-0000-000000000000', 'Digit Member', '2');
select is((select level || '/' || skill from public.members where display_name = 'Digit Member'), 'beginner/2', 'A member saved with "2" gets skill 2');

select * from finish();
rollback;
