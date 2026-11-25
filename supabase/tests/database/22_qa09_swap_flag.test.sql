-- QA-09 (BR19): swap_not_ready only swaps a player who flagged "not ready".
-- Run: npm run test:db   (needs the local stack: npx supabase start)
begin;
select plan(7);

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
create function pg_temp.court() returns uuid language sql as $$
  select id from public.courts where session_id = pg_temp.sid('s');
$$;

insert into auth.users (id, instance_id, aud, role, email, is_anonymous) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.com', false);
insert into public.clubs (id, name, created_by) values ('c9000000-0000-0000-0000-000000000000', 'QA-09 Club', '11111111-1111-1111-1111-111111111111');
insert into public.club_staff (club_id, user_id, role) values ('c9000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'owner');

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select set_config('test.s', public.create_session('c9000000-0000-0000-0000-000000000000', 'QA-09 Night', now(), now() + interval '3h', 1, p_start => true)::text, true);
select public.add_walk_in(pg_temp.sid('s'), name, 'unsure', null, null, null, null)
from unnest(array['Ana', 'Ben', 'Carlo', 'Dina', 'Eli']) name;
select public.call_next(pg_temp.court());

-- Not flagged: refused, nothing changes.
select is(pg_temp.err($$ select public.swap_not_ready(pg_temp.court(), pg_temp.pid('Ana')) $$), 'player_not_flagged',
  'BR19: swapping a player who never said not ready is refused');
reset role;
select is((select status from public.session_players where id = pg_temp.pid('Ana')), 'playing', 'Ana stays on court');
select is((select status from public.session_players where id = pg_temp.pid('Eli')), 'queued', 'Eli stays in line');

-- Not on court still says so first (the outbox treats it as already done).
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(pg_temp.err($$ select public.swap_not_ready(pg_temp.court(), pg_temp.pid('Eli')) $$), 'player_not_on_court',
  'A player who is not on court: player_not_on_court');
reset role;

-- Flagged (as player_not_ready does): the swap works as before.
update public.session_players set not_ready_at = now() where id = pg_temp.pid('Ana');
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(public.swap_not_ready(pg_temp.court(), pg_temp.pid('Ana')), pg_temp.pid('Eli'), 'BR19: a flagged player is swapped for Eli');
reset role;
select results_eq($$ select status, not_ready_at from public.session_players where id = pg_temp.pid('Ana') $$,
  $$ values ('queued'::text, null::timestamptz) $$, 'Ana is queued with the flag cleared');

-- Repeating the swap (e.g. from the outbox) is refused as not on court, not as not flagged.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(pg_temp.err($$ select public.swap_not_ready(pg_temp.court(), pg_temp.pid('Ana')) $$), 'player_not_on_court',
  'A repeated swap: player_not_on_court');
reset role;

select * from finish();
rollback;
