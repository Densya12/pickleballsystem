-- Phase 9 / D25 part 2: presets (mixed | same_level | fair_line).
-- Run: npm run test:db   (needs the local stack: npx supabase start)
begin;
select plan(14);

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
create function pg_temp.mm(p_key text) returns text language sql as $$ select matchmaking from public.sessions where id = pg_temp.sid(p_key) $$;

insert into auth.users (id, instance_id, aud, role, email, is_anonymous) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.com', false),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@example.com', false),
  ('77777777-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true);
insert into public.clubs (id, name, created_by) values ('c9200000-0000-0000-0000-000000000000', 'Preset Club', '11111111-1111-1111-1111-111111111111');
insert into public.club_staff (club_id, user_id, role) values ('c9200000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'owner');

select is((select default_matchmaking from public.clubs where id = 'c9200000-0000-0000-0000-000000000000'), 'fair_line',
  'A club written without a preset (e.g. by the deployed app) defaults to Fair line');

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select set_config('test.a', public.create_session('c9200000-0000-0000-0000-000000000000', 'Night A', now(), now() + interval '3h', 1)::text, true);
reset role;
select is(pg_temp.mm('a'), 'fair_line', 'create_session takes the club default (Fair line)');

update public.clubs set default_matchmaking = 'mixed' where id = 'c9200000-0000-0000-0000-000000000000';
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select set_config('test.b', public.create_session('c9200000-0000-0000-0000-000000000000', 'Night B', now(), now() + interval '3h', 1)::text, true);
reset role;
select is(pg_temp.mm('b'), 'mixed', 'create_session takes the club default (Mixed)');

-- Draft and live sessions can change; ended can't.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(pg_temp.err($$ select public.set_session_matchmaking(pg_temp.sid('b'), 'same_level') $$), 'no error', 'Draft: set Same level');
select is(pg_temp.err($$ select public.set_session_matchmaking(pg_temp.sid('b'), 'random') $$), 'invalid_matchmaking', 'Unknown preset refused');
select is(pg_temp.err($$ select public.set_session_matchmaking(pg_temp.sid('b'), null) $$), 'invalid_matchmaking', 'Null refused');
select public.start_session(pg_temp.sid('b'));
select is(pg_temp.err($$ select public.set_session_matchmaking(pg_temp.sid('b'), 'fair_line') $$), 'no error', 'Live: set Fair line');
select is(pg_temp.err($$ select public.set_session_matchmaking(pg_temp.sid('b'), 'fair_line') $$), 'no error', 'The same preset again is accepted (outbox resend)');
reset role;
select is(pg_temp.mm('b'), 'fair_line', 'Now Fair line');
select is((select count(*)::int from public.events where session_id = pg_temp.sid('b') and type = 'matchmaking_changed'), 2, 'Two changes logged; the repeat logged nothing');
select is((select payload::text from public.events where session_id = pg_temp.sid('b') and type = 'matchmaking_changed' order by created_at desc limit 1),
  '{"to": "fair_line", "from": "same_level"}', 'The event says from and to');

-- Access.
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select is(pg_temp.err($$ select public.set_session_matchmaking(pg_temp.sid('b'), 'mixed') $$), 'session_not_found', 'Another club''s organizer is refused');
reset role;
select pg_temp.as_user('77777777-0000-0000-0000-000000000001', '{"is_anonymous": true}');
select is(pg_temp.err($$ select public.set_session_matchmaking(pg_temp.sid('b'), 'mixed') $$), '42501 not_organizer_account', 'A player is refused');
reset role;

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.end_session(pg_temp.sid('b'));
select is(pg_temp.err($$ select public.set_session_matchmaking(pg_temp.sid('b'), 'mixed') $$), 'session_not_live', 'Ended: refused');
reset role;

select * from finish();
rollback;
