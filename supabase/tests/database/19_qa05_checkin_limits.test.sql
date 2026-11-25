-- QA-05: one phone can't flood a queue. (a) a check-in can't reuse the name of
-- someone already in line (case- and space-insensitive); the organizer's
-- walk-in may (the app warns). (b) at most 200 active players per session.
-- Run: npm run test:db   (needs the local stack: npx supabase start)
begin;
select plan(14);

create function pg_temp.as_user(p_sub uuid, p_anon boolean default false) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_sub, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
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
create function pg_temp.code() returns text language sql as $$ select current_setting('test.code') $$;

insert into auth.users (id, instance_id, aud, role, email, is_anonymous)
select ('77777777-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true
from generate_series(1, 6) i;
insert into auth.users (id, instance_id, aud, role, email, is_anonymous) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.com', false);
insert into public.clubs (id, name, created_by) values ('c1000000-0000-0000-0000-000000000000', 'QA-05 Club', '11111111-1111-1111-1111-111111111111');
insert into public.club_staff (club_id, user_id, role) values ('c1000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'owner');
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select set_config('test.s', public.create_session('c1000000-0000-0000-0000-000000000000', 'QA-05 Night', now(), now() + interval '3h', 2, p_start => true)::text, true);
select set_config('test.code', (select join_code from public.sessions where id = pg_temp.sid('s')), true);

-- (a) Duplicate names at check-in.
select pg_temp.as_user('77777777-0000-0000-0000-000000000001', true);
select set_config('test.mark', public.join_session(pg_temp.code(), 'Mark Santos', 'unsure', null, null)::text, true);
select is(pg_temp.err($$ select public.join_session(pg_temp.code(), 'Mark Santos', 'unsure', null, null) $$), 'no error',
  'The same phone joining again gets its own row back (not a duplicate-name error)');
select pg_temp.as_user('77777777-0000-0000-0000-000000000002', true);
select is(pg_temp.err($$ select public.join_session(pg_temp.code(), 'Mark Santos', 'unsure', null, null) $$), 'name_taken',
  'Another phone with the same name is refused');
select is(pg_temp.err($$ select public.join_session(pg_temp.code(), '  mark   SANTOS ', 'unsure', null, null) $$), 'name_taken',
  'Case and spaces don''t make it a different name');
select is(pg_temp.err($$ select public.join_session(pg_temp.code(), 'MarkSantos', 'unsure', null, null) $$), 'name_taken',
  'Nor does leaving the space out');
select is(pg_temp.err($$ select public.join_session(pg_temp.code(), 'Mark S.', 'unsure', null, null) $$), 'no error',
  'Adding a last initial works');
-- A walk-in by the organizer may reuse a name (the app warns and lets them override).
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(pg_temp.err($$ select public.add_walk_in(pg_temp.sid('s'), 'Mark Santos', 'unsure', 'later', null, null, null) $$), 'no error',
  'The organizer can still add a walk-in with the same name');
-- Once a player has left, their name is free again.
select pg_temp.as_user('77777777-0000-0000-0000-000000000001', true);
select public.player_leave(pg_temp.sid('mark'));
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.remove_player(p.id) from public.session_players p where p.session_id = pg_temp.sid('s') and p.display_name = 'Mark Santos' and p.status <> 'left';
select pg_temp.as_user('77777777-0000-0000-0000-000000000003', true);
select is(pg_temp.err($$ select public.join_session(pg_temp.code(), 'Mark Santos', 'unsure', null, null) $$), 'no error',
  'After the other Mark Santos left, the name can be used');

-- (b) At most 200 active players. Fill up to 200 with walk-ins.
reset role;
select is((select count(*)::int from public.session_players where session_id = pg_temp.sid('s') and status <> 'left'), 2, 'Setup: 2 active');
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.add_walk_in(pg_temp.sid('s'), 'Filler ' || i, 'unsure', 'later', null, null, null) from generate_series(1, 198) i;
reset role;
select is((select count(*)::int from public.session_players where session_id = pg_temp.sid('s') and status <> 'left'), 200, '200 active players');
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(pg_temp.err($$ select public.add_walk_in(pg_temp.sid('s'), 'One Too Many', 'unsure', 'later', null, null, null) $$), 'session_full',
  'The 201st (walk-in) is refused');
select pg_temp.as_user('77777777-0000-0000-0000-000000000004', true);
select is(pg_temp.err($$ select public.join_session(pg_temp.code(), 'Phone Too Many', 'unsure', null, null) $$), 'session_full',
  'The 201st (check-in) is refused');
-- Making room: remove one, then one more can join.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.remove_player((select id from public.session_players where session_id = pg_temp.sid('s') and display_name = 'Filler 1'));
select pg_temp.as_user('77777777-0000-0000-0000-000000000004', true);
select is(pg_temp.err($$ select public.join_session(pg_temp.code(), 'Phone Too Many', 'unsure', null, null) $$), 'no error',
  'After a removal there is room for one more');
-- Any way back to active counts too (Undo of a removal sets status back): full, so it's refused.
reset role;
select is((select count(*)::int from public.session_players where session_id = pg_temp.sid('s') and status <> 'left'), 200, 'Full again');
select is(pg_temp.err($$ update public.session_players set status = 'queued'
                         where session_id = pg_temp.sid('s') and display_name = 'Filler 1' $$), 'session_full',
  'A left player coming back (as Undo does) can''t take the session past 200');

select * from finish();
rollback;
