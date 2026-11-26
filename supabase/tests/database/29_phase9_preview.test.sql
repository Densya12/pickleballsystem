-- Phase 9 / D25 part 5: queue_preview (who would be called next), for staff
-- and the session's own players only, without payment data, read-only.
-- Run: npm run test:db   (needs the local stack: npx supabase start)
begin;
select plan(13);

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
create function pg_temp.names(p jsonb) returns text language sql as $$
  select string_agg(e ->> 'name', ',' order by e ->> 'name') from jsonb_array_elements(p) e;
$$;

insert into auth.users (id, instance_id, aud, role, email, is_anonymous) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.com', false),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@example.com', false),
  ('77777777-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true),
  ('77777777-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true);
insert into public.clubs (id, name, created_by) values
  ('c9500000-0000-0000-0000-000000000000', 'Preview Club', '11111111-1111-1111-1111-111111111111'),
  ('c9500000-0000-0000-0000-000000000002', 'Other Club', '22222222-2222-2222-2222-222222222222');
insert into public.club_staff (club_id, user_id, role) values
  ('c9500000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('c9500000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'owner');

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select set_config('test.s', public.create_session('c9500000-0000-0000-0000-000000000000', 'Preview Night', now(), now() + interval '3h', 2,
  p_fee => 150, p_pay_first => false, p_start => true, p_court_formats => array['doubles', 'singles'])::text, true);
select public.set_session_matchmaking(pg_temp.sid('s'), 'mixed');
select public.add_walk_in(pg_temp.sid('s'), n, l, 'gcash', '1234567890')
from (values ('Ana', '3'), ('Bea', '5'), ('Cy', '2'), ('Dee', '3'), ('Eli', '4'), ('Fe', '3')) v(n, l);
reset role;
-- A player of this session, and a player of another club's session.
select set_config('test.code', (select join_code from public.sessions where id = pg_temp.sid('s')), true);
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select set_config('test.o', public.create_session('c9500000-0000-0000-0000-000000000002', 'Other Night', now(), now() + interval '3h', 1, p_start => true)::text, true);
reset role;
select set_config('test.ocode', (select join_code from public.sessions where id = pg_temp.sid('o')), true);
select pg_temp.as_user('77777777-0000-0000-0000-000000000001', '{"is_anonymous": true}');
select public.join_session(current_setting('test.code'), 'Phone Gil', '3');
reset role;
select pg_temp.as_user('77777777-0000-0000-0000-000000000002', '{"is_anonymous": true}');
select public.join_session(current_setting('test.ocode'), 'Elsewhere', 'unsure');
reset role;

create temporary table before_skips as select id, skip_count from public.session_players where session_id = pg_temp.sid('s');

-- Staff.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
create temporary table pv as select public.queue_preview(pg_temp.sid('s')) as v;
select is((select v ->> 'preset' from pv), 'mixed', 'Staff: the preset');
select is((select v -> 'formats' -> 'doubles' ->> 'status' from pv), 'ok', 'Doubles: a group is ready');
select is(pg_temp.names((select v -> 'formats' -> 'doubles' -> 'group' from pv)), 'Ana,Cy,Dee,Fe', 'Doubles preview: Ana (3) with Cy, Dee, Fe (levels 2-3)');
select is((select array[(v -> 'formats' -> 'doubles' ->> 'lo'), (v -> 'formats' -> 'doubles' ->> 'hi')] from pv), array['2', '3'], 'With the level range');
select is((select v -> 'formats' -> 'singles' ->> 'status' from pv), 'ok', 'A preview per court format (singles too)');
select is((select string_agg(k, ',' order by k) from pv, jsonb_array_elements(v -> 'formats' -> 'doubles' -> 'group') e, jsonb_object_keys(e) k
           where e ->> 'name' = 'Ana'), 'id,name,skill', 'Each player: id, name and level only (no payment data)');
reset role;
select ok(not exists (select 1 from public.session_players p join before_skips b on b.id = p.id where p.skip_count <> b.skip_count),
  'The preview writes nothing (skip counts unchanged)');

-- The preview is what the next call does.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.call_next((select id from public.courts where session_id = pg_temp.sid('s') and number = 1));
reset role;
select is((select string_agg(p.display_name, ',' order by p.display_name)
           from public.games g join public.session_players p on p.id = any (g.player_ids)
           where g.session_id = pg_temp.sid('s') and g.ended_at is null and g.format = 'doubles'),
  'Ana,Cy,Dee,Fe', 'call_next calls the previewed group');

-- Players of this session can read it; others can't.
select pg_temp.as_user('77777777-0000-0000-0000-000000000001', '{"is_anonymous": true}');
select is(pg_temp.err($$ select public.queue_preview(pg_temp.sid('s')) $$), 'no error', 'A player of this session can read the preview');
reset role;
select pg_temp.as_user('77777777-0000-0000-0000-000000000002', '{"is_anonymous": true}');
select is(pg_temp.err($$ select public.queue_preview(pg_temp.sid('s')) $$), 'session_not_found', 'A player of another session is refused');
reset role;
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select is(pg_temp.err($$ select public.queue_preview(pg_temp.sid('s')) $$), 'session_not_found', 'Another club''s organizer is refused');
reset role;
select pg_temp.as_user('77777777-0000-0000-0000-000000000009', '{"is_anonymous": true}');
select is(pg_temp.err($$ select public.queue_preview(pg_temp.sid('s')) $$), 'session_not_found', 'A stranger is refused');
reset role;

-- An ended session: no preview.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.end_session(pg_temp.sid('s'));
select is((select public.queue_preview(pg_temp.sid('s')) -> 'formats'), '{}'::jsonb, 'Ended: nothing to preview');
reset role;

select * from finish();
rollback;
