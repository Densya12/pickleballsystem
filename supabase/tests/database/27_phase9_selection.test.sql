-- Phase 9 / D25 part 3: group selection (Mixed, Same level), skip
-- protection, Call mixed, Winners stay with levels, singles, swap.
-- Fair line is covered by the existing queue tests, which run unchanged.
-- Run: npm run test:db   (needs the local stack: npx supabase start)
begin;
select plan(41);

create function pg_temp.as_owner() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  perform set_config('role', 'authenticated', true);
end;
$$;
create function pg_temp.err(p_sql text) returns text language plpgsql as $$
declare v_msg text; v_state text; v_detail text;
begin
  execute p_sql;
  return 'no error';
exception when others then
  get stacked diagnostics v_msg = message_text, v_state = returned_sqlstate, v_detail = pg_exception_detail;
  return case when v_state = 'P0001' then v_msg || coalesce(':' || nullif(v_detail, ''), '') else v_state || ' ' || v_msg end;
end;
$$;
create function pg_temp.sid(p_key text) returns uuid language sql as $$ select current_setting('test.' || p_key)::uuid $$;
create function pg_temp.pid(p_s uuid, p_name text) returns uuid language sql as $$
  select id from public.session_players where session_id = p_s and display_name = 'P ' || p_name and status <> 'left';
$$;
create function pg_temp.court(p_s uuid, p_n int default 1) returns uuid language sql as $$ select id from public.courts where session_id = p_s and number = p_n $$;
create function pg_temp.game(p_s uuid, p_n int default 1) returns uuid language sql as $$ select current_game_id from public.courts where session_id = p_s and number = p_n $$;
-- Players on a court, sorted (who plays, not the order).
create function pg_temp.on_court(p_s uuid, p_n int default 1) returns text language sql as $$
  select string_agg(substr(p.display_name, 3), ',' order by p.display_name)
  from public.courts c join public.games g on g.id = c.current_game_id join public.session_players p on p.id = any (g.player_ids)
  where c.session_id = p_s and c.number = p_n;
$$;
create function pg_temp.skips(p_s uuid) returns text language sql as $$
  select string_agg(substr(display_name, 3) || '=' || skip_count, ',' order by queue_pos) from public.session_players
  where session_id = p_s and skip_count > 0;
$$;
-- A new live session (ends the club's live one first) with walk-ins "Name:level" in this order.
create function pg_temp.session(p_key text, p_preset text, p_rotation text, p_format text, p_players text[]) returns void language plpgsql as $$
declare v_s uuid; v_p text;
begin
  perform public.end_session(s.id) from public.sessions s where s.club_id = 'c9300000-0000-0000-0000-000000000000' and s.status = 'live';
  v_s := public.create_session('c9300000-0000-0000-0000-000000000000', 'Sel ' || p_key, now(), now() + interval '3h', 1, 11, p_rotation, false, 0, true, array[p_format]);
  perform public.set_session_matchmaking(v_s, p_preset);
  foreach v_p in array p_players loop
    -- Names get a "P " prefix (2-character minimum); the helpers strip it.
    perform public.add_walk_in(v_s, 'P ' || split_part(v_p, ':', 1), coalesce(nullif(split_part(v_p, ':', 2), ''), 'unsure'));
  end loop;
  perform set_config('test.' || p_key, v_s::text, true);
end;
$$;
create function pg_temp.win(p_s uuid, p_names text[]) returns void language sql as $$
  select public.finish_game(pg_temp.court(p_s), pg_temp.game(p_s), array(select pg_temp.pid(p_s, n) from unnest(p_names) n));
$$;

insert into auth.users (id, instance_id, aud, role, email, is_anonymous) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.com', false);
insert into public.clubs (id, name, created_by) values ('c9300000-0000-0000-0000-000000000000', 'Selection Club', '11111111-1111-1111-1111-111111111111');
insert into public.club_staff (club_id, user_id, role) values ('c9300000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'owner');
select pg_temp.as_owner();

-- ---------------------------------------------------------------------------
-- Mixed: the anchor is always in; within +-1; lowest positions win.
-- Queue: A3 B5 C2 D3 E4 F1 G3 H2. Valid with A: levels {2,3} or {3,4}.
-- {A,C,D,G} ranks 1+3+4+7 = 15 beats {A,C,D,H} 16 and {A,D,E,G} 17.
-- ---------------------------------------------------------------------------
select pg_temp.session('mx', 'mixed', 'all_off', 'doubles', array['A:3','B:5','C:2','D:3','E:4','F:1','G:3','H:2']);
select public.call_next(pg_temp.court(pg_temp.sid('mx')));
select is(pg_temp.on_court(pg_temp.sid('mx')), 'A,C,D,G', 'Mixed: anchor A (3) with C2, D3, G3 (levels 2-3, lowest positions)');
select is(pg_temp.skips(pg_temp.sid('mx')), 'B=1,E=1,F=1', 'B, E and F were passed over (skip +1 each); H was not (behind the group)');
select is((select call_note from public.games where id = pg_temp.game(pg_temp.sid('mx'))),
  '{"hi": 3, "lo": 2, "preset": "mixed", "repeats": 0}'::jsonb, 'The game notes the preset, levels 2-3 and no repeats');
select is((select skip_count from public.session_players where id = pg_temp.pid(pg_temp.sid('mx'), 'A')), 0, 'Called players reset to 0');

-- Deterministic: the same state gives the same group (the selection is read-only).
reset role;
select is(private.select_group(pg_temp.sid('mx'), 'doubles', '{}'), private.select_group(pg_temp.sid('mx'), 'doubles', '{}'),
  'select_group is deterministic');
select pg_temp.as_owner();

-- ---------------------------------------------------------------------------
-- Same level: everyone equal. Not set fits any level.
-- ---------------------------------------------------------------------------
select pg_temp.session('sl', 'same_level', 'all_off', 'doubles', array['A:3','B:2','C:3','D:4','E:3','F:3']);
select public.call_next(pg_temp.court(pg_temp.sid('sl')));
select is(pg_temp.on_court(pg_temp.sid('sl')), 'A,C,E,F', 'Same level: A3 with C3, E3, F3');

select pg_temp.session('ns', 'same_level', 'all_off', 'doubles', array['A:2','N1:','B:4','N2:','C:2']);
select public.call_next(pg_temp.court(pg_temp.sid('ns')));
select is(pg_temp.on_court(pg_temp.sid('ns')), 'A,C,N1,N2', 'Not set fits any level: A2, N1, N2, C2 (B4 skipped)');

select pg_temp.session('nn', 'mixed', 'all_off', 'doubles', array['N1:','N2:','N3:','N4:']);
select public.call_next(pg_temp.court(pg_temp.sid('nn')));
select is(pg_temp.on_court(pg_temp.sid('nn')), 'N1,N2,N3,N4', 'Nobody has a level: queue order');
select is((select call_note from public.games where id = pg_temp.game(pg_temp.sid('nn'))), '{"preset": "mixed", "repeats": 0}'::jsonb, 'No level range in the note');

-- ---------------------------------------------------------------------------
-- Variety: avoid players who shared a recent game.
-- P1 and P2 played together; queue P1..P6 all level 3: {P1,P3,P4,P5} (13) beats {P1,P2,P3,P4} (10 + 10).
-- ---------------------------------------------------------------------------
select pg_temp.session('va', 'mixed', 'all_off', 'doubles', array['P1:3','P2:3','X1:3','X2:3','P3:3','P4:3','P5:3','P6:3']);
reset role;
-- Make P1, P2, X1, X2 a finished game, then put them back at the front in order P1, P2.
insert into public.games (session_id, court_id, number, player_ids, format, started_at, ended_at)
select pg_temp.sid('va'), pg_temp.court(pg_temp.sid('va')), 1,
       array[pg_temp.pid(pg_temp.sid('va'), 'P1'), pg_temp.pid(pg_temp.sid('va'), 'P2'), pg_temp.pid(pg_temp.sid('va'), 'X1'), pg_temp.pid(pg_temp.sid('va'), 'X2')],
       'doubles', now() - interval '20 minutes', now() - interval '5 minutes';
update public.session_players set status = 'paused' where id in (pg_temp.pid(pg_temp.sid('va'), 'X1'), pg_temp.pid(pg_temp.sid('va'), 'X2'));
select pg_temp.as_owner();
select public.call_next(pg_temp.court(pg_temp.sid('va')));
select is(pg_temp.on_court(pg_temp.sid('va')), 'P1,P3,P4,P5', 'Variety: P2 (P1''s recent partner) waits; P3, P4, P5 play');
select is((select call_note ->> 'repeats' from public.games where id = pg_temp.game(pg_temp.sid('va'))), '0', 'No repeated pair');
select is(pg_temp.skips(pg_temp.sid('va')), 'P2=1', 'P2 was passed over once');

-- ---------------------------------------------------------------------------
-- Skip protection: someone skipped twice can't be passed over again.
-- Queue A3 B5 C3 D3 E3: B was skipped twice; every group with A would pass
-- over B (who doesn't fit with A): no call.
-- ---------------------------------------------------------------------------
select pg_temp.session('sk', 'mixed', 'all_off', 'doubles', array['A:3','B:5','C:3','D:3','E:3']);
reset role;
update public.session_players set skip_count = 2 where id = pg_temp.pid(pg_temp.sid('sk'), 'B');
select pg_temp.as_owner();
select is(pg_temp.err($$ select public.call_next(pg_temp.court(pg_temp.sid('sk'))) $$), 'no_level_group:2-4',
  'No valid group (B can''t be skipped a 3rd time): no_level_group with the anchor''s band 2-4');
reset role;
select is((private.select_group(pg_temp.sid('sk'), 'doubles', '{}')) ->> 'status', 'no_group', 'The selection reports no_group');
select pg_temp.as_owner();
select is(pg_temp.on_court(pg_temp.sid('sk')), null, 'Nobody was called');
-- Skipped once only: B can be passed over (2nd time).
reset role;
update public.session_players set skip_count = 1 where id = pg_temp.pid(pg_temp.sid('sk'), 'B');
select pg_temp.as_owner();
select public.call_next(pg_temp.court(pg_temp.sid('sk')));
select is(pg_temp.on_court(pg_temp.sid('sk')), 'A,C,D,E', 'B skipped once: passed over a 2nd time');
select is(pg_temp.skips(pg_temp.sid('sk')), 'B=2', 'B is now at 2');
-- A skipped-twice player who fits is pulled into the next group.
select pg_temp.session('sk2', 'mixed', 'all_off', 'doubles', array['A:3','C:3','D:3','E:3','F:3','G:3']);
reset role;
update public.session_players set skip_count = 2 where id = pg_temp.pid(pg_temp.sid('sk2'), 'F');
select pg_temp.as_owner();
select public.call_next(pg_temp.court(pg_temp.sid('sk2')));
select is(pg_temp.on_court(pg_temp.sid('sk2')), 'A,C,D,E', 'Nobody in front of F was passed over, so F waits without a skip');
select is(pg_temp.skips(pg_temp.sid('sk2')), 'F=2', 'F still at 2 (not skipped: nobody behind F was chosen)');

-- ---------------------------------------------------------------------------
-- Call mixed: the anchor and the next eligible in queue order, once.
-- ---------------------------------------------------------------------------
select pg_temp.session('cm', 'same_level', 'all_off', 'doubles', array['A:1','B:5','C:3','D:2']);
select is(pg_temp.err($$ select public.call_next(pg_temp.court(pg_temp.sid('cm'))) $$), 'no_level_group:1-1', 'Same level, nobody else at 1: no group (band 1)');
select is(pg_temp.err($$ select public.call_mixed(pg_temp.court(pg_temp.sid('cm'))) $$), 'no error', 'Call mixed works');
select is(pg_temp.on_court(pg_temp.sid('cm')), 'A,B,C,D', 'Call mixed: queue order, levels ignored');
select is((select call_note from public.games where id = pg_temp.game(pg_temp.sid('cm'))),
  '{"hi": 5, "lo": 1, "preset": "same_level", "mixed_call": true}'::jsonb, 'The note marks a mixed call (levels 1-5)');
reset role;
select is((select count(*)::int from public.events where session_id = pg_temp.sid('cm') and type = 'mixed_call'), 1, 'The mixed call is logged');
select pg_temp.as_owner();
select is(pg_temp.err($$ select public.call_mixed(pg_temp.court(pg_temp.sid('cm'))) $$), 'court_busy', 'Call mixed on a busy court: court_busy');

-- ---------------------------------------------------------------------------
-- Winners stay with levels (g): the newcomers fit with the winners.
-- W1 W2 (4) beat L1 L2 (4); waiting Q1:4 Q2:2 Q3:4 Q4:5.
-- Fixed W1, W2 (4): the anchor Q1 (4) plus the lowest fitting newcomer, Q3 (4); Q2 (2) is skipped.
-- ---------------------------------------------------------------------------
select pg_temp.session('ws', 'mixed', 'winners_stay', 'doubles', array['W1:4','W2:4','L1:4','L2:4','Q1:4','Q2:2','Q3:4','Q4:5']);
select public.call_next(pg_temp.court(pg_temp.sid('ws')));
select is(pg_temp.on_court(pg_temp.sid('ws')), 'L1,L2,W1,W2', 'First game');
select pg_temp.win(pg_temp.sid('ws'), array['W1','W2']);
select is(pg_temp.on_court(pg_temp.sid('ws')), 'Q1,Q3,W1,W2', 'Winners stay; newcomers Q1 and Q3 fit the 3-5 band with them');
select is((select stayed_ids from public.games where id = pg_temp.game(pg_temp.sid('ws'))),
  array[pg_temp.pid(pg_temp.sid('ws'), 'W1'), pg_temp.pid(pg_temp.sid('ws'), 'W2')], 'stayed_ids records who stayed on');
select is((select winner_streak from public.courts where id = pg_temp.court(pg_temp.sid('ws'))), 1, 'Streak 1');
-- BR11: a 2nd win in a row sends them off.
select pg_temp.win(pg_temp.sid('ws'), array['W1','W2']);
select is((select string_agg(substr(display_name, 3) || ':' || status, ',' order by display_name) from public.session_players
            where session_id = pg_temp.sid('ws') and display_name in ('P W1', 'P W2')), 'W1:queued,W2:queued',
  'BR11: after a 2nd win in a row W1 and W2 go off (to the queue)');
-- The new anchor is Q2 (level 2) and nobody else waiting is within 1: no call (Call mixed is offered).
select is(pg_temp.on_court(pg_temp.sid('ws')), null, 'The next anchor (Q2, level 2) has no level 1-3 group: the court waits');
select is((select winner_streak from public.courts where id = pg_temp.court(pg_temp.sid('ws'))), 0, 'Streak back to 0');

-- Winners can't stay when no newcomer fits with them: they go to the back, a fresh group plays.
select pg_temp.session('wf', 'same_level', 'winners_stay', 'doubles', array['W1:5','W2:5','L1:2','L2:2','Q1:2','Q2:2']);
select public.call_mixed(pg_temp.court(pg_temp.sid('wf')));
select pg_temp.win(pg_temp.sid('wf'), array['W1','W2']);
select is(pg_temp.on_court(pg_temp.sid('wf')), 'L1,L2,Q1,Q2', 'No level-5 newcomers: the winners go off; Q1, Q2 and the losers (all 2) play');

-- D23 still applies (fewer than 2 waiting): losers first, a winner sits out.
select pg_temp.session('d23', 'mixed', 'winners_stay', 'doubles', array['A:3','B:3','C:3','D:3','E:3']);
select public.call_next(pg_temp.court(pg_temp.sid('d23')));
select pg_temp.win(pg_temp.sid('d23'), array['A','B']);
select is((select count(*)::int from unnest(string_to_array(pg_temp.on_court(pg_temp.sid('d23')), ',')) n where n in ('A','B')), 1,
  'D23: with 1 waiting, one winner sits out');

-- ---------------------------------------------------------------------------
-- Singles: anchor + 1 (window 6).
-- ---------------------------------------------------------------------------
select pg_temp.session('sg', 'mixed', 'all_off', 'singles', array['S1:1','S2:4','S3:2','S4:5']);
select public.call_next(pg_temp.court(pg_temp.sid('sg')));
select is(pg_temp.on_court(pg_temp.sid('sg')), 'S1,S3', 'Singles: S1 (1) with S3 (2)');

-- ---------------------------------------------------------------------------
-- swap_not_ready (h): the replacement fits with the three on court; if
-- nobody fits, the longest-waiting player comes in anyway.
-- ---------------------------------------------------------------------------
select pg_temp.session('sw', 'same_level', 'all_off', 'doubles', array['A:3','B:3','C:3','D:3','E:5','F:3']);
select public.call_next(pg_temp.court(pg_temp.sid('sw')));
reset role;
update public.session_players set not_ready_at = now() where id = pg_temp.pid(pg_temp.sid('sw'), 'B');
select pg_temp.as_owner();
select is(public.swap_not_ready(pg_temp.court(pg_temp.sid('sw')), pg_temp.pid(pg_temp.sid('sw'), 'B')), pg_temp.pid(pg_temp.sid('sw'), 'F'),
  'Swap: F (3) comes in, not E (5), who doesn''t fit with three level-3s');
reset role;
update public.session_players set not_ready_at = now() where id = pg_temp.pid(pg_temp.sid('sw'), 'C');
update public.session_players set status = 'paused' where id = pg_temp.pid(pg_temp.sid('sw'), 'B');
select pg_temp.as_owner();
select is(public.swap_not_ready(pg_temp.court(pg_temp.sid('sw')), pg_temp.pid(pg_temp.sid('sw'), 'C')), pg_temp.pid(pg_temp.sid('sw'), 'E'),
  'Nobody fits: the longest-waiting player (E) comes in anyway');

-- ---------------------------------------------------------------------------
-- Undo restores skip counts.
-- ---------------------------------------------------------------------------
-- Same level: A3 E4 B3 C3 D3 F3 G3 H3 I4 J4 K4. The first call passes over E (=1);
-- after Done the anchor is E: E, I, J, K play and F, G, H are passed over.
select pg_temp.session('un', 'same_level', 'all_off', 'doubles', array['A:3','E:4','B:3','C:3','D:3','F:3','G:3','H:3','I:4','J:4','K:4']);
select public.call_next(pg_temp.court(pg_temp.sid('un')));
select is(pg_temp.skips(pg_temp.sid('un')), 'E=1', 'E (4) passed over by the level-3 group');
select pg_temp.win(pg_temp.sid('un'), array['A','B']);
select is(pg_temp.on_court(pg_temp.sid('un')), 'E,I,J,K', 'Then E anchors the level-4 group');
select is(pg_temp.skips(pg_temp.sid('un')), 'F=1,G=1,H=1', 'E reset; F, G, H passed over');
select public.undo_last(pg_temp.sid('un'));
select is(pg_temp.skips(pg_temp.sid('un')), 'E=1', 'Undo of the Done restores the skip counts');

reset role;
select * from finish();
rollback;
