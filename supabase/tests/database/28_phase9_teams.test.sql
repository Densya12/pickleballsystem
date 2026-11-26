-- Phase 9 / D25 part 4: teams (positions 1-2 vs 3-4), balanced suggestions,
-- swap_sides, and the 2-win limit with team ordering (stayed_ids, not positions).
-- Run: npm run test:db   (needs the local stack: npx supabase start)
begin;
select plan(18);

create function pg_temp.as_user(p_sub uuid, p_extra jsonb default '{}') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', (jsonb_build_object('sub', p_sub, 'role', 'authenticated') || p_extra)::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;
create function pg_temp.as_owner() returns void language sql as $$ select pg_temp.as_user('11111111-1111-1111-1111-111111111111') $$;
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
create function pg_temp.pid(p_s uuid, p_name text) returns uuid language sql as $$
  select id from public.session_players where session_id = p_s and display_name = 'P ' || p_name and status <> 'left';
$$;
create function pg_temp.court(p_s uuid) returns uuid language sql as $$ select id from public.courts where session_id = p_s and number = 1 $$;
create function pg_temp.game(p_s uuid) returns uuid language sql as $$ select current_game_id from public.courts where session_id = p_s and number = 1 $$;
-- The current game's players in position order (team 1 = first two).
create function pg_temp.lineup(p_s uuid) returns text language sql as $$
  select string_agg(substr(p.display_name, 3), ',' order by u.i)
  from public.games g, unnest(g.player_ids) with ordinality u(id, i) join public.session_players p on p.id = u.id
  where g.id = pg_temp.game(p_s);
$$;
create function pg_temp.session(p_key text, p_preset text, p_rotation text, p_format text, p_players text[]) returns void language plpgsql as $$
declare v_s uuid; v_p text;
begin
  perform public.end_session(s.id) from public.sessions s where s.club_id = 'c9400000-0000-0000-0000-000000000000' and s.status = 'live';
  v_s := public.create_session('c9400000-0000-0000-0000-000000000000', 'Teams ' || p_key, now(), now() + interval '3h', 1, 11, p_rotation, false, 0, true, array[p_format]);
  perform public.set_session_matchmaking(v_s, p_preset);
  foreach v_p in array p_players loop
    perform public.add_walk_in(v_s, 'P ' || split_part(v_p, ':', 1), coalesce(nullif(split_part(v_p, ':', 2), ''), 'unsure'));
  end loop;
  perform set_config('test.' || p_key, v_s::text, true);
end;
$$;
create function pg_temp.win(p_s uuid, p_names text[]) returns void language sql as $$
  select public.finish_game(pg_temp.court(p_s), pg_temp.game(p_s), array(select pg_temp.pid(p_s, n) from unnest(p_names) n));
$$;

insert into auth.users (id, instance_id, aud, role, email, is_anonymous) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.com', false),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@example.com', false),
  ('77777777-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true);
insert into public.clubs (id, name, created_by) values ('c9400000-0000-0000-0000-000000000000', 'Teams Club', '11111111-1111-1111-1111-111111111111');
insert into public.club_staff (club_id, user_id, role) values ('c9400000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'owner');
select pg_temp.as_owner();

-- Balanced: A4 B3 C2 D1 -> highest with lowest: A+D (5) vs B+C (5).
select pg_temp.session('bal', 'mixed', 'all_off', 'doubles', array['A:2','B:2','C:2','D:2']);
reset role;
update public.session_players set skill = v.s from (values ('P A', 4), ('P B', 3), ('P C', 2), ('P D', 1)) v(n, s)
where display_name = v.n and session_id = pg_temp.sid('bal');
select pg_temp.as_owner();
reset role;
update public.sessions set matchmaking = 'fair_line' where id = pg_temp.sid('bal');
select pg_temp.as_owner();
-- Called in Fair line (queue order) but the teams are only ordered in Mixed/Same level:
select public.call_next(pg_temp.court(pg_temp.sid('bal')));
select is(pg_temp.lineup(pg_temp.sid('bal')), 'A,B,C,D', 'Fair line keeps today''s order (the order players were called)');
select public.finish_game(pg_temp.court(pg_temp.sid('bal')), pg_temp.game(pg_temp.sid('bal')), null);
reset role;
update public.sessions set matchmaking = 'mixed' where id = pg_temp.sid('bal');
update public.session_players set skill = null where session_id = pg_temp.sid('bal');
update public.session_players set skill = v.s, queue_pos = v.q from (values ('P A', 4, 1), ('P B', 3, 2), ('P C', 2, 3), ('P D', 1, 4)) v(n, s, q)
where display_name = v.n and session_id = pg_temp.sid('bal');
-- (No level rule can hold 1-4 in Mixed, so test the team order directly.)
select is((select string_agg(substr(p.display_name, 3), ',' order by u.i)
           from unnest(private.order_teams(pg_temp.sid('bal'),
                  array[pg_temp.pid(pg_temp.sid('bal'),'A'), pg_temp.pid(pg_temp.sid('bal'),'B'), pg_temp.pid(pg_temp.sid('bal'),'C'), pg_temp.pid(pg_temp.sid('bal'),'D')], '{}'))
                with ordinality u(id, i) join public.session_players p on p.id = u.id),
  'A,D,B,C', 'Balanced: A (4) + D (1) vs B (3) + C (2)');
-- Not set counts as the group's average: A4, N(not set), C2, D2 -> avg of set = 2.67.
update public.session_players set skill = null where display_name = 'P B' and session_id = pg_temp.sid('bal');
select is((select string_agg(substr(p.display_name, 3), ',' order by u.i)
           from unnest(private.order_teams(pg_temp.sid('bal'),
                  array[pg_temp.pid(pg_temp.sid('bal'),'A'), pg_temp.pid(pg_temp.sid('bal'),'B'), pg_temp.pid(pg_temp.sid('bal'),'C'), pg_temp.pid(pg_temp.sid('bal'),'D')], '{}'))
                with ordinality u(id, i) join public.session_players p on p.id = u.id),
  'A,D,B,C', 'Not set (B) counts as the average (2.67): A+D (5) vs B+C (4.67)');
select pg_temp.as_owner();

-- Equal levels: highest with lowest in call order; but if that pairs recent
-- partners, the pairing with fewer recent partners wins.
select pg_temp.session('tie', 'mixed', 'all_off', 'doubles', array['A:3','B:3','C:3','D:3','X1:3','X2:3']);
reset role;
create temporary table tie_ids as select array[pg_temp.pid(pg_temp.sid('tie'),'A'), pg_temp.pid(pg_temp.sid('tie'),'B'), pg_temp.pid(pg_temp.sid('tie'),'C'), pg_temp.pid(pg_temp.sid('tie'),'D')] as ids;
create function pg_temp.names(p_ids uuid[]) returns text language sql as $$
  select string_agg(substr(p.display_name, 3), ',' order by u.i) from unnest(p_ids) with ordinality u(id, i) join public.session_players p on p.id = u.id;
$$;
select is(pg_temp.names(private.order_teams(pg_temp.sid('tie'), (select ids from tie_ids), '{}')), 'A,D,B,C',
  'Equal levels, no history: highest with lowest in call order (A+D vs B+C)');
-- A and D were partners in their last game (positions 1-2).
insert into public.games (session_id, court_id, number, player_ids, format, started_at, ended_at)
values (pg_temp.sid('tie'), pg_temp.court(pg_temp.sid('tie')), 1,
        array[pg_temp.pid(pg_temp.sid('tie'),'A'), pg_temp.pid(pg_temp.sid('tie'),'D'), pg_temp.pid(pg_temp.sid('tie'),'X1'), pg_temp.pid(pg_temp.sid('tie'),'X2')],
        'doubles', now() - interval '20 minutes', now() - interval '5 minutes');
select is(pg_temp.names(private.order_teams(pg_temp.sid('tie'), (select ids from tie_ids), '{}')), 'A,C,B,D',
  'A and D were just partners: A+C vs B+D instead');
select pg_temp.as_owner();

-- Winners stay: the winners are team 1. The 2-win limit compares who stayed, not positions.
select pg_temp.session('ws', 'mixed', 'winners_stay', 'doubles', array['W1:3','W2:3','L1:3','L2:3','Q1:3','Q2:3','Q3:3','Q4:3']);
select public.call_next(pg_temp.court(pg_temp.sid('ws')));
select pg_temp.win(pg_temp.sid('ws'), (select array[substr(p.display_name, 3), substr(q.display_name, 3)]
  from public.games g join public.session_players p on p.id = g.player_ids[1] join public.session_players q on q.id = g.player_ids[2]
  where g.id = pg_temp.game(pg_temp.sid('ws'))));
select ok(pg_temp.lineup(pg_temp.sid('ws')) ~ '^(W1|W2|L1|L2),(W1|W2|L1|L2),Q', 'The winners stay together as team 1 (left), newcomers team 2');
create temporary table stayers as select stayed_ids from public.games where id = pg_temp.game(pg_temp.sid('ws'));
-- The organizer moves the staying pair to the right side (positions 3-4) with two swaps.
select public.swap_sides(pg_temp.court(pg_temp.sid('ws')), (select stayed_ids[1] from stayers), (select player_ids[3] from public.games where id = pg_temp.game(pg_temp.sid('ws'))));
select public.swap_sides(pg_temp.court(pg_temp.sid('ws')), (select stayed_ids[2] from stayers), (select player_ids[4] from public.games where id = pg_temp.game(pg_temp.sid('ws'))));
select is((select player_ids[3:4] from public.games where id = pg_temp.game(pg_temp.sid('ws'))), (select stayed_ids from stayers),
  'The staying pair is now on the right (positions 3-4)');
-- They win again: a 2nd win in a row, even though they aren't the first positions.
select public.finish_game(pg_temp.court(pg_temp.sid('ws')), pg_temp.game(pg_temp.sid('ws')), (select stayed_ids from stayers));
select ok(not exists (select 1 from public.games g, stayers s where g.id = pg_temp.game(pg_temp.sid('ws')) and g.player_ids && s.stayed_ids),
  'BR11 still holds: after a 2nd win in a row (from the right side) the pair goes off');
select is((select winner_streak from public.courts where id = pg_temp.court(pg_temp.sid('ws'))), 0, 'Streak back to 0');

-- D23 with team ordering: fewer than 2 waiting, a winner sits out.
select pg_temp.session('d23', 'mixed', 'winners_stay', 'doubles', array['A:3','B:3','C:3','D:3','E:3']);
select public.call_next(pg_temp.court(pg_temp.sid('d23')));
select public.finish_game(pg_temp.court(pg_temp.sid('d23')), pg_temp.game(pg_temp.sid('d23')),
  (select player_ids[1:2] from public.games where id = pg_temp.game(pg_temp.sid('d23'))));
select is((select count(*)::int from public.session_players where session_id = pg_temp.sid('d23') and status = 'queued'), 1, 'D23: one player (a winner) sits out');

-- swap_sides: rules and access.
select pg_temp.session('ss', 'mixed', 'all_off', 'doubles', array['A:3','B:3','C:3','D:3','E:3']);
select public.call_next(pg_temp.court(pg_temp.sid('ss')));
create temporary table g_ss as select player_ids from public.games where id = pg_temp.game(pg_temp.sid('ss'));
select is(pg_temp.err($$ select public.swap_sides(pg_temp.court(pg_temp.sid('ss')), (select player_ids[1] from g_ss), (select player_ids[2] from g_ss)) $$),
  'same_side', 'Two players on the same side: same_side');
select is(pg_temp.err($$ select public.swap_sides(pg_temp.court(pg_temp.sid('ss')), (select player_ids[1] from g_ss), pg_temp.pid(pg_temp.sid('ss'), 'E')) $$),
  'player_not_on_court', 'A player not in the game: player_not_on_court');
select is(pg_temp.err($$ select public.swap_sides(pg_temp.court(pg_temp.sid('ss')), (select player_ids[1] from g_ss), (select player_ids[3] from g_ss)) $$),
  'no error', 'Opposite sides: swapped');
select is((select array[player_ids[1], player_ids[3]] from public.games where id = pg_temp.game(pg_temp.sid('ss'))),
  (select array[player_ids[3], player_ids[1]] from g_ss), 'Positions 1 and 3 traded places');
reset role;
select is((select count(*)::int from public.events where session_id = pg_temp.sid('ss') and type = 'sides_swapped'), 1, 'Logged as sides_swapped');
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select ok(pg_temp.err($$ select public.swap_sides(pg_temp.court(pg_temp.sid('ss')), (select player_ids[1] from g_ss), (select player_ids[3] from g_ss)) $$) <> 'no error',
  'Another club''s organizer is refused');
reset role;
select pg_temp.as_user('77777777-0000-0000-0000-000000000001', '{"is_anonymous": true}');
select is(pg_temp.err($$ select public.swap_sides(pg_temp.court(pg_temp.sid('ss')), (select player_ids[1] from g_ss), (select player_ids[3] from g_ss)) $$),
  '42501 not_organizer_account', 'A player is refused');
reset role;
select pg_temp.as_owner();
select public.end_session(pg_temp.sid('ss'));
select is(pg_temp.err($$ select public.swap_sides(pg_temp.court(pg_temp.sid('ss')), (select player_ids[1] from g_ss), (select player_ids[3] from g_ss)) $$),
  'session_not_live', 'An ended session: refused');
reset role;

select * from finish();
rollback;
