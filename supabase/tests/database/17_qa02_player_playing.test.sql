-- QA-02: pause/resume/remove tell "player is on court" (player_playing) apart
-- from "already in that state" (invalid_player_status), so the offline outbox
-- doesn't count a refused Remove as done.
-- Run: npm run test:db   (needs the local stack: npx supabase start)
begin;
select plan(9);

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
create function pg_temp.pid(p_name text) returns uuid language sql as $$
  select id from public.session_players where session_id = pg_temp.sid('s') and display_name = p_name;
$$;

insert into auth.users (id, instance_id, aud, role, email, is_anonymous) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.com', false);
insert into public.clubs (id, name, created_by) values ('c1000000-0000-0000-0000-000000000000', 'QA-02 Club', '11111111-1111-1111-1111-111111111111');
insert into public.club_staff (club_id, user_id, role) values ('c1000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'owner');

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select set_config('test.s', public.create_session('c1000000-0000-0000-0000-000000000000', 'QA-02 Night', now(), now() + interval '3h', 1, p_start => true)::text, true);
select public.add_walk_in(pg_temp.sid('s'), name, 'unsure', null, null, null, null)
from unnest(array['Ana', 'Ben', 'Carlo', 'Dina', 'Eli', 'Fe', 'Gil']) name;
select public.call_next((select id from public.courts where session_id = pg_temp.sid('s')));

-- On court: a new, distinct code.
select is(pg_temp.err($$ select public.remove_player(pg_temp.pid('Ana')) $$), 'player_playing', 'Remove a player on court: player_playing');
select is(pg_temp.err($$ select public.pause_player(pg_temp.pid('Ana')) $$), 'player_playing', 'Pause a player on court: player_playing');
select is(pg_temp.err($$ select public.resume_player(pg_temp.pid('Ana')) $$), 'player_playing', 'Resume a player on court: player_playing');

-- Already in that state (a repeat): still invalid_player_status (the outbox counts it as done).
select public.pause_player(pg_temp.pid('Eli'));
select is(pg_temp.err($$ select public.pause_player(pg_temp.pid('Eli')) $$), 'invalid_player_status', 'Pause twice: invalid_player_status');
select is(pg_temp.err($$ select public.resume_player(pg_temp.pid('Fe')) $$), 'invalid_player_status', 'Resume a waiting player: invalid_player_status');
select public.remove_player(pg_temp.pid('Gil'));
select is(pg_temp.err($$ select public.remove_player(pg_temp.pid('Gil')) $$), 'invalid_player_status', 'Remove twice: invalid_player_status');
select is(pg_temp.err($$ select public.pause_player(pg_temp.pid('Gil')) $$), 'invalid_player_status', 'Pause a removed player: invalid_player_status');

-- The normal paths still work.
select is(pg_temp.err($$ select public.remove_player(pg_temp.pid('Fe')) $$), 'no error', 'Remove a waiting player works');
reset role;
select is((select status from public.session_players where id = pg_temp.pid('Ana')), 'playing', 'The refused calls left Ana on court');

select * from finish();
rollback;
