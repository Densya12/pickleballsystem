-- QA-03 / D23: Winners stay with fewer than 2 players waiting. Everyone goes
-- off with the LOSERS FIRST, so a winner sits out. With 2 or more waiting
-- nothing changes (winners stay, at most 2 wins in a row).
-- Run: npm run test:db   (needs the local stack: npx supabase start)
begin;
select plan(10);

create function pg_temp.as_owner() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  perform set_config('role', 'authenticated', true);
end;
$$;
create function pg_temp.sid(p_key text) returns uuid language sql as $$ select current_setting('test.' || p_key)::uuid $$;
create function pg_temp.pid(p_s uuid, p_name text) returns uuid language sql as $$
  select id from public.session_players where session_id = p_s and display_name = p_name and status <> 'left';
$$;
create function pg_temp.court(p_s uuid) returns uuid language sql as $$ select id from public.courts where session_id = p_s and number = 1 $$;
create function pg_temp.game(p_s uuid) returns uuid language sql as $$ select current_game_id from public.courts where session_id = p_s and number = 1 $$;
-- Players on court 1, sorted (who plays, not the order).
create function pg_temp.on_court(p_s uuid) returns text language sql as $$
  select string_agg(p.display_name, ',' order by p.display_name)
  from public.courts c join public.games g on g.id = c.current_game_id join public.session_players p on p.id = any (g.player_ids)
  where c.session_id = p_s and c.number = 1;
$$;
create function pg_temp.streak(p_s uuid) returns integer language sql as $$ select winner_streak from public.courts where session_id = p_s and number = 1 $$;
-- New live session (ends the club's previous one, BR1) with n walk-ins, called.
create function pg_temp.session(p_key text, p_format text, p_players int) returns void language plpgsql as $$
declare v_s uuid;
begin
  perform public.end_session(s.id) from public.sessions s where s.club_id = 'c1000000-0000-0000-0000-000000000000' and s.status = 'live';
  v_s := public.create_session('c1000000-0000-0000-0000-000000000000', 'QA-03 ' || p_key, now(), now() + interval '3h', 1, 11, 'winners_stay', false, 0, true, array[p_format]);
  perform public.add_walk_in(v_s, 'P' || i, 'unsure', null, null, null, null) from generate_series(1, p_players) i;
  perform public.call_next(pg_temp.court(v_s));
  perform set_config('test.' || p_key, v_s::text, true);
end;
$$;
create function pg_temp.win(p_s uuid, p_names text[]) returns void language sql as $$
  select public.finish_game(pg_temp.court(p_s), pg_temp.game(p_s), array(select pg_temp.pid(p_s, n) from unnest(p_names) n));
$$;

insert into auth.users (id, instance_id, aud, role, email, is_anonymous) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.com', false);
insert into public.clubs (id, name, created_by) values ('c1000000-0000-0000-0000-000000000000', 'QA-03 Club', '11111111-1111-1111-1111-111111111111');
insert into public.club_staff (club_id, user_id, role) values ('c1000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'owner');
select pg_temp.as_owner();

-- Doubles, 5 players: P1-P4 play, P5 waits. P1+P2 win.
select pg_temp.session('d5', 'doubles', 5);
select pg_temp.win(pg_temp.sid('d5'), array['P1', 'P2']);
select is(pg_temp.on_court(pg_temp.sid('d5')), 'P1,P3,P4,P5', 'D23 doubles, 1 waiting: the waiting player, both losers and one winner play next');
select is(pg_temp.streak(pg_temp.sid('d5')), 0, 'Everyone went off: streak back to 0');
-- The winners can't keep the court for ever: P1 (again a winner) and P3 win; P2 sat out the last game.
select pg_temp.win(pg_temp.sid('d5'), array['P1', 'P3']);
select is(pg_temp.on_court(pg_temp.sid('d5')), 'P2,P3,P4,P5', 'Next game: the winner who sat out is back, a winner sits out (P1)');

-- Singles, 3 players: P1 v P2, P3 waits. P1 wins.
select pg_temp.session('s3', 'singles', 3);
select pg_temp.win(pg_temp.sid('s3'), array['P1']);
select is(pg_temp.on_court(pg_temp.sid('s3')), 'P2,P3', 'D23 singles, 1 waiting: the waiting player and the loser play next');
select pg_temp.win(pg_temp.sid('s3'), array['P3']);
select is(pg_temp.on_court(pg_temp.sid('s3')), 'P1,P2', 'Then P1 (who sat out) and the loser');

-- Nothing waiting at all (2 players, singles): the same two play again.
select pg_temp.session('s2', 'singles', 2);
select pg_temp.win(pg_temp.sid('s2'), array['P1']);
select is(pg_temp.on_court(pg_temp.sid('s2')), 'P1,P2', 'Nobody waiting: the same two play again');

-- 2 or more waiting: unchanged. Doubles, 6 players: winners stay with the next 2.
select pg_temp.session('d6', 'doubles', 6);
select pg_temp.win(pg_temp.sid('d6'), array['P1', 'P2']);
select is(pg_temp.on_court(pg_temp.sid('d6')), 'P1,P2,P5,P6', '2 waiting: the winners stay and the next 2 join');
select is(pg_temp.streak(pg_temp.sid('d6')), 1, 'Streak 1');
-- Singles, 4 players (2 waiting): the winner stays.
select pg_temp.session('s4', 'singles', 4);
select pg_temp.win(pg_temp.sid('s4'), array['P1']);
select is(pg_temp.on_court(pg_temp.sid('s4')), 'P1,P3', 'Singles, 2 waiting: the winner stays, the next one joins');
select is(pg_temp.streak(pg_temp.sid('s4')), 1, 'Streak 1');

select * from finish();
rollback;
