-- QA-07: names without invisible or text-direction characters, and with at
-- least one visible letter or number (shared rule: name_cases.inc).
-- Run: npm run test:db   (needs the local stack: npx supabase start)
begin;
\ir name_cases.inc
select plan((select jsonb_array_length(current_setting('test.name_cases')::jsonb) * 2 + 6));

select is(private.clean_display_name(c ->> 'input'), c ->> 'cleaned', 'clean: ' || (c ->> 'input'))
from jsonb_array_elements(current_setting('test.name_cases')::jsonb) c;
select is(private.display_name_ok(private.clean_display_name(c ->> 'input')), (c ->> 'ok')::boolean, 'ok: ' || (c ->> 'input'))
from jsonb_array_elements(current_setting('test.name_cases')::jsonb) c;

-- Applied on every write (players and members).
insert into auth.users (id, instance_id, aud, role, email, is_anonymous) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.com', false);
insert into public.clubs (id, name, created_by) values ('c1000000-0000-0000-0000-000000000000', 'QA-07 Club', '11111111-1111-1111-1111-111111111111');
insert into public.club_staff (club_id, user_id, role) values ('c1000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'owner');
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select set_config('test.s', public.create_session('c1000000-0000-0000-0000-000000000000', 'QA-07 Night', now(), now() + interval '3h', 1, p_start => true)::text, true);
select public.add_walk_in(current_setting('test.s')::uuid, E'Ana‮abc 2', 'unsure', null, null, null, null);
select throws_ok($$ select public.add_walk_in(current_setting('test.s')::uuid, E'​​​', 'unsure', null, null, null, null) $$,
  '23514', null, 'A zero-width-only walk-in is refused');
select throws_ok($$ select public.add_walk_in(current_setting('test.s')::uuid, E'\U0001F3D3\U0001F3D3', 'unsure', null, null, null, null) $$,
  '23514', 'name_needs_letter', 'An emoji-only name is refused');
-- The duplicate-name check (QA-05) compares cleaned names.
reset role;
select is((select display_name from public.session_players where session_id = current_setting('test.s')::uuid), 'Anaabc 2', 'Stored cleaned');
select is(private.player_name_key(E'A​naabc  2'), private.player_name_key('Anaabc 2'), 'Hidden characters don''t make a name different');
set local role authenticated;
insert into public.members (club_id, display_name) values ('c1000000-0000-0000-0000-000000000000', E'⁦Ben Cruz⁩');
select throws_ok($$ insert into public.members (club_id, display_name) values ('c1000000-0000-0000-0000-000000000000', '...') $$,
  '23514', 'name_needs_letter', 'Members need a letter or number too');
reset role;
select is((select display_name from public.members where club_id = 'c1000000-0000-0000-0000-000000000000'), 'Ben Cruz', 'Member names are cleaned');

select * from finish();
rollback;
