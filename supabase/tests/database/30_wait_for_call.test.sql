-- Phase 9.1b / D26: "Wait for me" (the organizer calls the next game) and the
-- call_mode setting. Auto-call stays exactly as before (the existing queue
-- tests run unchanged on auto_call sessions).
-- Run: npm run test:db   (needs the local stack: npx supabase start)
begin;
select plan(41);

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
create function pg_temp.court(p_s uuid, p_n integer default 1) returns uuid language sql as $$ select id from public.courts where session_id = p_s and number = p_n $$;
create function pg_temp.game(p_s uuid, p_n integer default 1) returns uuid language sql as $$ select current_game_id from public.courts where session_id = p_s and number = p_n $$;
create function pg_temp.names(p_ids uuid[]) returns text language sql as $$
  select string_agg(substr(p.display_name, 3), ',' order by substr(p.display_name, 3)) from unnest(p_ids) u(id) join public.session_players p on p.id = u.id;
$$;
create function pg_temp.status_of(p_s uuid, p_names text[]) returns text language sql as $$
  select string_agg(distinct p.status, ',') from public.session_players p where p.session_id = p_s and substr(p.display_name, 3) = any (p_names);
$$;
-- A live session on c9500000 with call mode, rotation, preset, court formats and players ('name:level').
create function pg_temp.session(p_key text, p_mode text, p_rotation text, p_preset text, p_formats text[], p_players text[]) returns void language plpgsql as $$
declare v_s uuid; v_p text;
begin
  perform public.end_session(s.id) from public.sessions s where s.club_id = 'c9500000-0000-0000-0000-000000000000' and s.status = 'live';
  v_s := public.create_session('c9500000-0000-0000-0000-000000000000', 'Wait ' || p_key, now(), now() + interval '3h',
                               cardinality(p_formats), 11, p_rotation, false, 0, true, p_formats);
  perform public.set_session_call_mode(v_s, p_mode);
  perform public.set_session_matchmaking(v_s, p_preset);
  foreach v_p in array p_players loop
    perform public.add_walk_in(v_s, 'P ' || split_part(v_p, ':', 1), coalesce(nullif(split_part(v_p, ':', 2), ''), 'unsure'));
  end loop;
  perform set_config('test.' || p_key, v_s::text, true);
end;
$$;
create function pg_temp.win(p_s uuid, p_names text[], p_court integer default 1) returns uuid language sql as $$
  select public.finish_game(pg_temp.court(p_s, p_court), pg_temp.game(p_s, p_court), array(select pg_temp.pid(p_s, n) from unnest(p_names) n));
$$;
-- The current game's first team (positions 1-2), as names.
create function pg_temp.team1(p_s uuid) returns text[] language sql as $$
  select array[substr(a.display_name, 3), substr(b.display_name, 3)]
  from public.games g join public.session_players a on a.id = g.player_ids[1] join public.session_players b on b.id = g.player_ids[2]
  where g.id = pg_temp.game(p_s);
$$;

insert into auth.users (id, instance_id, aud, role, email, is_anonymous) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.com', false),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@example.com', false),
  ('77777777-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true);
insert into public.clubs (id, name, created_by) values ('c9500000-0000-0000-0000-000000000000', 'Wait Club', '11111111-1111-1111-1111-111111111111');
insert into public.club_staff (club_id, user_id, role) values ('c9500000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'owner');
select pg_temp.as_owner();

-- ---------------------------------------------------------------------------
-- The setting
-- ---------------------------------------------------------------------------
select is((select default_call_mode from public.clubs where id = 'c9500000-0000-0000-0000-000000000000'), 'auto_call',
  'A club created without the new app (column default) keeps auto-call');
create temporary table s0 as select public.create_session('c9500000-0000-0000-0000-000000000000', 'Draft', now(), now() + interval '3h', 1) as id;
select is((select call_mode from public.sessions where id = (select id from s0)), 'auto_call', 'New sessions take the club default (auto_call)');
update public.clubs set default_call_mode = 'wait' where id = 'c9500000-0000-0000-0000-000000000000';
create temporary table s1 as select public.create_session('c9500000-0000-0000-0000-000000000000', 'Draft 2', now(), now() + interval '3h', 1) as id;
select is((select call_mode from public.sessions where id = (select id from s1)), 'wait', 'New sessions take the club default (wait)');
update public.clubs set default_call_mode = 'auto_call' where id = 'c9500000-0000-0000-0000-000000000000';

select is(pg_temp.err(format('select public.set_session_call_mode(%L, %L)', (select id from s0), 'sometimes')), 'invalid_call_mode', 'Unknown call modes are refused');
select public.set_session_call_mode((select id from s0), 'wait');
select public.set_session_call_mode((select id from s0), 'wait');
select is((select count(*)::int from public.events where session_id = (select id from s0) and type = 'call_mode_changed'), 1,
  'Works on a draft; idempotent: the same choice twice logs one change (safe to resend from the outbox)');
select is((select payload from public.events where session_id = (select id from s0) and type = 'call_mode_changed'),
  '{"from": "auto_call", "to": "wait"}'::jsonb, 'The change is logged (from, to)');
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select isnt(pg_temp.err(format('select public.set_session_call_mode(%L, %L)', (select id from s0), 'auto_call')), 'no error', 'Staff of another club cannot change it');
select pg_temp.as_user('77777777-0000-0000-0000-000000000001', '{"is_anonymous": true}');
select isnt(pg_temp.err(format('select public.set_session_call_mode(%L, %L)', (select id from s0), 'auto_call')), 'no error', 'A player (anonymous) cannot change it');
select pg_temp.as_owner();
select is((select call_mode from public.sessions where id = (select id from s0)), 'wait', 'Refused changes leave it as it was');
select public.delete_draft_session((select id from s0));
select public.delete_draft_session((select id from s1));

-- ---------------------------------------------------------------------------
-- Auto-call: unchanged (Done calls the next group at once)
-- ---------------------------------------------------------------------------
select pg_temp.session('auto', 'auto_call', 'all_off', 'fair_line', array['doubles'], array['A','B','C','D','E','F','G','H']);
select public.call_next(pg_temp.court(pg_temp.sid('auto')));
select isnt(public.finish_game(pg_temp.court(pg_temp.sid('auto')), pg_temp.game(pg_temp.sid('auto')), null), null, 'Auto-call: Done starts the next game');
select is((select waiting_since from public.courts where id = pg_temp.court(pg_temp.sid('auto'))), null, 'Auto-call: the court never waits');

-- ---------------------------------------------------------------------------
-- Wait for me, All off
-- ---------------------------------------------------------------------------
select pg_temp.session('w', 'wait', 'all_off', 'mixed', array['doubles'],
  array['A:3','B:3','C:3','D:3','E:4','F:3','G:2','H:3']);
select public.call_next(pg_temp.court(pg_temp.sid('w')));
create temporary table w_first as select player_ids from public.games where id = pg_temp.game(pg_temp.sid('w'));
select is(public.finish_game(pg_temp.court(pg_temp.sid('w')), pg_temp.game(pg_temp.sid('w')), null), null, 'Wait for me: Done returns no next game');
select is((select current_game_id from public.courts where id = pg_temp.court(pg_temp.sid('w'))), null, 'The court is empty');
select is((select count(*)::int from public.games where session_id = pg_temp.sid('w') and ended_at is null), 0, 'Nothing auto-starts');
select isnt((select waiting_since from public.courts where id = pg_temp.court(pg_temp.sid('w'))), null, 'The court records when it started waiting');
select is((select count(*)::int from public.session_players where session_id = pg_temp.sid('w') and status = 'queued'), 8, 'All off: everyone is back in the queue');
select is((select count(*)::int from public.session_players p, w_first f where p.id = any (f.player_ids) and p.games_played = 1), 4, 'The game counts (games played)');
-- Call: the D25 selection, exactly.
reset role;
create temporary table w_expected as select private.uuids_of(private.select_group(pg_temp.sid('w'), 'doubles', '{}') -> 'group') as ids;
grant select on w_expected to authenticated;
select pg_temp.as_owner();
select public.call_next(pg_temp.court(pg_temp.sid('w')));
select is(pg_temp.names((select player_ids from public.games where id = pg_temp.game(pg_temp.sid('w')))), pg_temp.names((select ids from w_expected)),
  'Call uses the D25 selection (select_group)');
select is((select waiting_since from public.courts where id = pg_temp.court(pg_temp.sid('w'))), null, 'Call ends the wait');
-- No level group: Call refuses with the band; Call mixed plays queue order.
select public.finish_game(pg_temp.court(pg_temp.sid('w')), pg_temp.game(pg_temp.sid('w')), null);
reset role;
update public.sessions set matchmaking = 'same_level' where id = pg_temp.sid('w');
update public.session_players set skill = v.s from (values ('P A', 1), ('P B', 2), ('P C', 3), ('P D', 4), ('P E', 5), ('P F', 1), ('P G', 2), ('P H', 3)) v(n, s)
where display_name = v.n and session_id = pg_temp.sid('w');
select pg_temp.as_owner();
select ok(pg_temp.err(format('select public.call_next(%L)', pg_temp.court(pg_temp.sid('w')))) = 'no_level_group', 'Call: "No level group yet" as before');
select isnt(public.call_mixed(pg_temp.court(pg_temp.sid('w'))), null, 'Call mixed works on a waiting court');

-- ---------------------------------------------------------------------------
-- Wait for me, Winners stay
-- ---------------------------------------------------------------------------
select pg_temp.session('ws', 'wait', 'winners_stay', 'fair_line', array['doubles', 'doubles'],
  array['A','B','C','D','E','F','G','H','I','J']);
select public.call_next(pg_temp.court(pg_temp.sid('ws')));
create temporary table ws_win as select pg_temp.team1(pg_temp.sid('ws')) as names;
select is(pg_temp.win(pg_temp.sid('ws'), (select names from ws_win)), null, 'Winners stay: Done starts nothing');
select is(pg_temp.names((select staying_ids from public.courts where id = pg_temp.court(pg_temp.sid('ws')))), array_to_string((select names from ws_win), ','),
  'The winners stay on the court');
select is(pg_temp.status_of(pg_temp.sid('ws'), (select names from ws_win)), 'playing', 'Staying winners are still playing (not in the queue)');
select is((select winner_streak from public.courts where id = pg_temp.court(pg_temp.sid('ws'))), 1, 'The streak counts the win');
-- Nobody else is called onto their spots, and they aren't called elsewhere: court 2 takes 4 from the queue.
select public.call_next(pg_temp.court(pg_temp.sid('ws'), 2));
select ok(not ((select player_ids from public.games where id = pg_temp.game(pg_temp.sid('ws'), 2)) && (select staying_ids from public.courts where id = pg_temp.court(pg_temp.sid('ws')))),
  'Another court never calls the staying winners');
select is(pg_temp.err(format('select public.set_court_format(%L, %L)', pg_temp.court(pg_temp.sid('ws')), 'singles')), 'court_busy',
  'A court with staying winners is not empty (format can''t change)');
-- Call fills the other side; the game records who stayed.
select public.call_next(pg_temp.court(pg_temp.sid('ws')));
select ok((select cardinality(player_ids) = 4 and pg_temp.names(player_ids[1:2]) = array_to_string((select names from ws_win), ',')
           from public.games where id = pg_temp.game(pg_temp.sid('ws'))),
  'Call fills the other side: the winners on their side (team 1), 2 newcomers');
select is(pg_temp.names((select stayed_ids from public.games where id = pg_temp.game(pg_temp.sid('ws')))), array_to_string((select names from ws_win), ','),
  'The new game records the staying winners (stayed_ids) for the streak');
select is((select cardinality(staying_ids) from public.courts where id = pg_temp.court(pg_temp.sid('ws'))), 0, 'Nobody is "staying" once the game starts');
-- The 2-win limit with a delayed call: they win again, so everyone goes off.
select pg_temp.win(pg_temp.sid('ws'), (select names from ws_win));
select is((select cardinality(staying_ids) from public.courts where id = pg_temp.court(pg_temp.sid('ws'))), 0, 'BR11: a 2nd win in a row (after a delayed call): nobody stays');
select is(pg_temp.status_of(pg_temp.sid('ws'), (select names from ws_win)), 'queued', 'BR11: the winners go back to the queue');
select is((select winner_streak from public.courts where id = pg_temp.court(pg_temp.sid('ws'))), 0, 'BR11: the streak is back to 0');

-- Undo of a Done with stayers restores the finished game exactly.
select public.call_next(pg_temp.court(pg_temp.sid('ws')));
create temporary table ws_before as select current_game_id, winner_streak from public.courts where id = pg_temp.court(pg_temp.sid('ws'));
create temporary table ws_win2 as select pg_temp.team1(pg_temp.sid('ws')) as names;
select pg_temp.win(pg_temp.sid('ws'), (select names from ws_win2));
select is(public.undo_last(pg_temp.sid('ws')), 'game_finished', 'Undo after Done (with winners staying)');
select ok((select c.current_game_id = b.current_game_id and c.winner_streak = b.winner_streak and cardinality(c.staying_ids) = 0 and c.waiting_since is null
           from public.courts c, ws_before b where c.id = pg_temp.court(pg_temp.sid('ws'))),
  'Undo restores the court: the same game running, the same streak, nobody staying, not waiting');
select is((select count(*)::int from public.session_players p, public.games g
           where g.id = pg_temp.game(pg_temp.sid('ws')) and p.id = any (g.player_ids) and p.status = 'playing'), 4,
  'Undo: all four are playing the restored game');

-- D23 with a delayed call (singles): the winner stays at Done; at Call fewer than 2 wait, so everyone goes off.
select pg_temp.session('d23', 'wait', 'winners_stay', 'fair_line', array['singles'], array['A','B','C','D']);
select public.call_next(pg_temp.court(pg_temp.sid('d23')));
select pg_temp.win(pg_temp.sid('d23'), array['A']);
select is(pg_temp.names((select staying_ids from public.courts where id = pg_temp.court(pg_temp.sid('d23')))), 'A', 'Singles: the winner stays (2 others waiting at Done)');
select public.pause_player(pg_temp.pid(pg_temp.sid('d23'), 'C'));
select public.pause_player(pg_temp.pid(pg_temp.sid('d23'), 'D'));
select public.call_next(pg_temp.court(pg_temp.sid('d23')));
select is(pg_temp.names((select player_ids from public.games where id = pg_temp.game(pg_temp.sid('d23')))), 'A,B',
  'D23 at Call: with fewer than 2 waiting the winner goes off and a fresh pair is called');
select is((select stayed_ids from public.games where id = pg_temp.game(pg_temp.sid('d23'))), '{}'::uuid[], 'D23 at Call: nobody counts as staying (streak starts over)');

-- D23 at Done (doubles, 5 players): everyone off, nobody stays.
select pg_temp.session('d23b', 'wait', 'winners_stay', 'fair_line', array['doubles'], array['A','B','C','D','E']);
select public.call_next(pg_temp.court(pg_temp.sid('d23b')));
select pg_temp.win(pg_temp.sid('d23b'), pg_temp.team1(pg_temp.sid('d23b')));
select is((select count(*)::int from public.session_players where session_id = pg_temp.sid('d23b') and status = 'queued'), 5,
  'D23 at Done: fewer than 2 waiting, everyone goes off (nobody stays)');

-- Preview: a court with staying winners shows who Call would add.
select pg_temp.session('pv', 'wait', 'winners_stay', 'fair_line', array['doubles'], array['A','B','C','D','E','F']);
select public.call_next(pg_temp.court(pg_temp.sid('pv')));
select pg_temp.win(pg_temp.sid('pv'), pg_temp.team1(pg_temp.sid('pv')));
select is(jsonb_array_length(public.queue_preview(pg_temp.sid('pv')) -> 'courts' -> pg_temp.court(pg_temp.sid('pv'))::text -> 'group'), 2,
  'queue_preview: Call on the court with staying winners adds 2');

select * from finish();
rollback;
