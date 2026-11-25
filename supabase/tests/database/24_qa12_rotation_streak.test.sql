-- QA-12 (BR11): Winners stay -> All off -> Winners stay in the middle of a
-- game must not give the same pair a 3rd game in a row.
-- Run: npm run test:db   (needs the local stack: npx supabase start)
begin;
select plan(7);

create function pg_temp.as_owner() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  perform set_config('role', 'authenticated', true);
end;
$$;
create function pg_temp.sid(p_key text) returns uuid language sql as $$ select current_setting('test.' || p_key)::uuid $$;
create function pg_temp.pid(p_name text) returns uuid language sql as $$
  select id from public.session_players where session_id = pg_temp.sid('s') and display_name = p_name;
$$;
create function pg_temp.court() returns uuid language sql as $$ select id from public.courts where session_id = pg_temp.sid('s') $$;
create function pg_temp.game() returns uuid language sql as $$ select current_game_id from public.courts where session_id = pg_temp.sid('s') $$;
create function pg_temp.on_court() returns text language sql as $$
  select string_agg(p.display_name, ',' order by p.display_name)
  from public.courts c join public.games g on g.id = c.current_game_id join public.session_players p on p.id = any (g.player_ids)
  where c.session_id = pg_temp.sid('s');
$$;
create function pg_temp.streak() returns integer language sql as $$ select winner_streak from public.courts where session_id = pg_temp.sid('s') $$;
create function pg_temp.win(p_names text[]) returns void language sql as $$
  select public.finish_game(pg_temp.court(), pg_temp.game(), array(select pg_temp.pid(n) from unnest(p_names) n));
$$;

insert into auth.users (id, instance_id, aud, role, email, is_anonymous) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.com', false);
insert into public.clubs (id, name, created_by) values ('c1200000-0000-0000-0000-000000000000', 'QA-12 Club', '11111111-1111-1111-1111-111111111111');
insert into public.club_staff (club_id, user_id, role) values ('c1200000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'owner');
select pg_temp.as_owner();

-- Winners stay, 1 doubles court, 10 players (always 2+ waiting, so D23 doesn't apply).
select set_config('test.s', public.create_session('c1200000-0000-0000-0000-000000000000', 'QA-12 Night', now(), now() + interval '3h', 1, 11, 'winners_stay', false, 0, true, array['doubles'])::text, true);
select public.add_walk_in(pg_temp.sid('s'), 'P' || i, 'unsure', 'later') from generate_series(1, 10) i;
select public.call_next(pg_temp.court());

-- P1+P2 win their 1st: they stay.
select pg_temp.win(array['P1', 'P2']);
select is(pg_temp.on_court(), 'P1,P2,P5,P6', 'P1+P2 won once: they stay');
select is(pg_temp.streak(), 1, 'Streak 1');

-- Mid-game, the organizer switches to All off and back.
select public.set_session_rotation(pg_temp.sid('s'), 'all_off');
select public.set_session_rotation(pg_temp.sid('s'), 'winners_stay');
select is(pg_temp.streak(), 1, 'QA-12: the toggle keeps the streak');

-- P1+P2 win their 2nd in a row: BR11, all four go off and the next group plays.
select pg_temp.win(array['P1', 'P2']);
select is(pg_temp.on_court(), 'P10,P7,P8,P9', 'BR11: after a 2nd win in a row P1+P2 go off (no 3rd game in a row)');
select is(pg_temp.streak(), 0, 'Streak back to 0');

-- Switching to All off and finishing a game still clears the streak.
select pg_temp.win(array['P7', 'P8']);
select public.set_session_rotation(pg_temp.sid('s'), 'all_off');
select public.finish_game(pg_temp.court(), pg_temp.game(), null);
select is(pg_temp.streak(), 0, 'An All off Done resets the streak');
select public.set_session_rotation(pg_temp.sid('s'), 'winners_stay');
select pg_temp.win(array[(select p.display_name from public.session_players p where p.id = (select player_ids[1] from public.games where id = pg_temp.game())),
                         (select p.display_name from public.session_players p where p.id = (select player_ids[2] from public.games where id = pg_temp.game()))]);
select is(pg_temp.streak(), 1, 'After All off, the next Winners stay win counts as the first');
reset role;

select * from finish();
rollback;
