-- Phase 9.2b / D29: the Balanced teams preset ('balanced'). Doubles: teams
-- within 1 (best pairing) and levels at most 3 apart; unknown levels count as
-- the group's average; staying winners are a team; singles as Mixed; score
-- repeats*10 + gap*5 + positions; anchor and skip cap as before; no_group
-- without a band. Mixed, Same level and Fair line: their own test files run
-- unchanged.
-- Run: npm run test:db   (needs the local stack: npx supabase start)
begin;
select plan(29);

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
  perform public.end_session(s.id) from public.sessions s where s.club_id = 'c9900000-0000-0000-0000-000000000000' and s.status = 'live';
  v_s := public.create_session('c9900000-0000-0000-0000-000000000000', 'Bal ' || p_key, now(), now() + interval '3h', 1, 11, p_rotation, false, 0, true, array[p_format]);
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
-- The current game's teams as "A+B|C+D" (position order).
create function pg_temp.teams(p_s uuid) returns text language sql as $$
  select substr(a.display_name, 3) || '+' || substr(b.display_name, 3) || '|' || substr(c.display_name, 3) || '+' || substr(d.display_name, 3)
  from public.games g
  join public.session_players a on a.id = g.player_ids[1] join public.session_players b on b.id = g.player_ids[2]
  join public.session_players c on c.id = g.player_ids[3] join public.session_players d on d.id = g.player_ids[4]
  where g.id = pg_temp.game(p_s);
$$;
-- The selection, read as the test's owner (private functions aren't granted to users).
create function pg_temp.sel(p_s uuid, p_format text default 'doubles') returns jsonb language sql security definer as $$ select private.select_group(p_s, p_format, '{}') $$;

insert into auth.users (id, instance_id, aud, role, email, is_anonymous) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.com', false);
insert into public.clubs (id, name, created_by) values ('c9900000-0000-0000-0000-000000000000', 'Balanced Club', '11111111-1111-1111-1111-111111111111');
insert into public.club_staff (club_id, user_id, role) values ('c9900000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'owner');
select pg_temp.as_owner();

-- ---------------------------------------------------------------------------
-- The preset
-- ---------------------------------------------------------------------------
update public.clubs set default_matchmaking = 'balanced' where id = 'c9900000-0000-0000-0000-000000000000';
select is((select default_matchmaking from public.clubs where id = 'c9900000-0000-0000-0000-000000000000'), 'balanced', 'Clubs accept balanced as the default');
create temporary table d as select public.create_session('c9900000-0000-0000-0000-000000000000', 'Default', now(), now() + interval '3h', 1) as id;
select is((select matchmaking from public.sessions where id = (select id from d)), 'balanced', 'New sessions copy it');
select is(pg_temp.err(format('select public.set_session_matchmaking(%L, %L)', (select id from d), 'even')), 'invalid_matchmaking', 'Unknown presets are still refused');
select lives_ok(format('select public.set_session_matchmaking(%L, %L)', (select id from d), 'mixed'), 'From balanced to mixed');
select lives_ok(format('select public.set_session_matchmaking(%L, %L)', (select id from d), 'balanced'), 'And back to balanced');
select public.delete_draft_session((select id from d));
update public.clubs set default_matchmaking = 'mixed' where id = 'c9900000-0000-0000-0000-000000000000';

-- ---------------------------------------------------------------------------
-- Valid and invalid groups (doubles)
-- ---------------------------------------------------------------------------
-- 4, 2, 3, 3: Mixed has no group (spread 2); Balanced plays 4+2 vs 3+3.
select pg_temp.session('mx', 'mixed', 'all_off', 'doubles', array['A:4','B:2','C:3','D:3']);
select is(pg_temp.sel(pg_temp.sid('mx')) ->> 'status', 'no_group', 'Mixed: 4, 2, 3, 3 is not a group (unchanged)');
select pg_temp.session('bt', 'balanced', 'all_off', 'doubles', array['A:4','B:2','C:3','D:3']);
select public.call_next(pg_temp.court(pg_temp.sid('bt')));
select is(pg_temp.teams(pg_temp.sid('bt')), 'A+B|C+D', 'Balanced: 4, 2, 3, 3 plays 4+2 vs 3+3');
select is((select call_note ->> 'preset' from public.games where id = pg_temp.game(pg_temp.sid('bt'))), 'balanced', 'The game notes the preset');

-- Spread: 5, 1, 3, 3 is even (6 vs 6) but 1 and 5 never share a court; 4, 1, 3, 2 (spread 3) is fine.
select pg_temp.session('s4', 'balanced', 'all_off', 'doubles', array['A:5','B:1','C:3','D:3']);
select is(pg_temp.sel(pg_temp.sid('s4')) ->> 'status', 'no_group', 'Spread 4 (5 and 1): no group, even with even teams');
select ok(not (pg_temp.sel(pg_temp.sid('s4')) ? 'lo') and not (pg_temp.sel(pg_temp.sid('s4')) ? 'hi'), 'No level band to wait for');
select is(pg_temp.err(format('select public.call_next(%L)', pg_temp.court(pg_temp.sid('s4')))), 'no_level_group', 'Call says no group (the app shows "No even teams right now")');
select isnt(public.call_mixed(pg_temp.court(pg_temp.sid('s4'))), null, 'Call mixed starts anyway');
select pg_temp.session('s3', 'balanced', 'all_off', 'doubles', array['A:4','B:1','C:3','D:2']);
select public.call_next(pg_temp.court(pg_temp.sid('s3')));
select is(pg_temp.on_court(pg_temp.sid('s3')), 'A,B,C,D', 'Spread 3 (4 and 1) with even teams (4+1 vs 3+2) is a group');

-- Team difference: 4, 4, 4, 1 (best 4+4 vs 4+1, off by 3) is not a group; the even one is chosen,
-- weighing the difference: {A,B,E,F} 4,4,3,3 (even, positions 14) beats {A,B,C,E} 4,4,4,3 (off by 1: 11 + 5).
select pg_temp.session('gap', 'balanced', 'all_off', 'doubles', array['A:4','B:4','C:4','D:1','E:3','F:3']);
select is((pg_temp.sel(pg_temp.sid('gap')) -> 'group') @> to_jsonb(array[pg_temp.pid(pg_temp.sid('gap'), 'D')]), false,
  'D (level 1) with three 4s is never a group');
select public.call_next(pg_temp.court(pg_temp.sid('gap')));
select is(pg_temp.on_court(pg_temp.sid('gap')), 'A,B,E,F', 'Even teams win over a 1-point difference (team difference x5)');
select is(pg_temp.skips(pg_temp.sid('gap')), 'C=1,D=1', 'C and D were passed over (skip +1)');

-- Unknown levels count as the group's average: 4, 1, ?, ? is even (4+1 vs 2.5+2.5); ? alone never blocks.
select pg_temp.session('unk', 'balanced', 'all_off', 'doubles', array['A:4','B:1','C:','D:']);
select public.call_next(pg_temp.court(pg_temp.sid('unk')));
select is(pg_temp.on_court(pg_temp.sid('unk')), 'A,B,C,D', 'Unknown levels count as the average and don''t block a group');
select pg_temp.session('unk2', 'balanced', 'all_off', 'doubles', array['A:5','B:','C:','D:']);
select is(pg_temp.sel(pg_temp.sid('unk2')) ->> 'status', 'ok', 'One known level and three unknown: a group');

-- The anchor is required: A (5) fits with nobody; B-E (all 2) would, but not without A.
select pg_temp.session('anc', 'balanced', 'all_off', 'doubles', array['A:5','B:2','C:2','D:2','E:2']);
select is(pg_temp.sel(pg_temp.sid('anc')) ->> 'status', 'no_group', 'The longest-waiting player is in every group (no group without them)');

-- Skip cap: B (1) is passed over for A,C,D,E (all 3) ...
select pg_temp.session('cap', 'balanced', 'all_off', 'doubles', array['A:3','B:1','C:3','D:3','E:3']);
select is(jsonb_array_length(pg_temp.sel(pg_temp.sid('cap')) -> 'skipped'), 1, 'B (1) is passed over: 3+1 vs 3+3 is off by 2');
-- ... but not after being passed over twice.
reset role;
update public.session_players set skip_count = 2 where id = pg_temp.pid(pg_temp.sid('cap'), 'B');
select pg_temp.as_owner();
select is(pg_temp.sel(pg_temp.sid('cap')) ->> 'status', 'no_group', 'Passed over twice: nobody can be called ahead of B any more (skip cap 2)');

-- Repeats: all level 3 (always even). A, B and C played together; queue A B E C F G H D.
select pg_temp.session('rep', 'balanced', 'all_off', 'doubles', array['A:3','B:3','C:3','D:3','E:3','F:3','G:3','H:3']);
select public.set_session_call_mode(pg_temp.sid('rep'), 'wait');
select public.call_next(pg_temp.court(pg_temp.sid('rep')));
select public.finish_game(pg_temp.court(pg_temp.sid('rep')), pg_temp.game(pg_temp.sid('rep')), null);
reset role;
update public.session_players p set queue_pos = v.pos
from (values ('P A', 1001), ('P B', 1002), ('P E', 1003), ('P C', 1004), ('P F', 1005), ('P G', 1006), ('P H', 1007), ('P D', 1008)) v(n, pos)
where p.session_id = pg_temp.sid('rep') and p.display_name = v.n;
select pg_temp.as_owner();
select public.call_next(pg_temp.court(pg_temp.sid('rep')));
select is(pg_temp.on_court(pg_temp.sid('rep')), 'A,E,F,G', 'Fewer repeats first: A with E, F, G (not B and C again)');

-- ---------------------------------------------------------------------------
-- Staying winners: they are a team; the 2 newcomers must be within 1 of them.
-- Winners 4+4 stay; E5 F5 G4 H4 wait: E+F (10) is off by 2; E (anchor) + G is 9.
-- ---------------------------------------------------------------------------
select pg_temp.session('ws', 'balanced', 'winners_stay', 'doubles', array['A:4','B:4','C:4','D:4','E:5','F:5','G:4','H:4']);
select public.call_next(pg_temp.court(pg_temp.sid('ws')));
create temporary table ws_win as select array[substr(a.display_name, 3), substr(b.display_name, 3)] as names
  from public.games g join public.session_players a on a.id = g.player_ids[1] join public.session_players b on b.id = g.player_ids[2]
  where g.id = pg_temp.game(pg_temp.sid('ws'));
select pg_temp.win(pg_temp.sid('ws'), (select names from ws_win));
select is((select array_to_string(array(select substr(p.display_name, 3) from unnest(g.player_ids[3:4]) u(id) join public.session_players p on p.id = u.id order by 1), ',')
           from public.games g where g.id = pg_temp.game(pg_temp.sid('ws'))), 'E,G',
  'Winners stay: the newcomers E (5) + G (4) = 9 vs 8; E + F (10) would be off by 2');
select is((select pg_temp.teams(pg_temp.sid('ws')) like (select names[1] || '+' || names[2] || '|%' from ws_win)), true, 'The winners keep the left side together');
select is((select skip_count from public.session_players where id = pg_temp.pid(pg_temp.sid('ws'), 'F')), 1, 'F was passed over');

-- ---------------------------------------------------------------------------
-- Singles: as Mixed (at most 1 apart)
-- ---------------------------------------------------------------------------
select pg_temp.session('sg', 'balanced', 'all_off', 'singles', array['A:3','B:5','C:4']);
select public.call_next(pg_temp.court(pg_temp.sid('sg')));
select is(pg_temp.on_court(pg_temp.sid('sg')), 'A,C', 'Singles: A (3) plays C (4), not B (5)');
select pg_temp.session('sg2', 'balanced', 'all_off', 'singles', array['A:1','B:3']);
select is(pg_temp.sel(pg_temp.sid('sg2'), 'singles') - 'anchor', '{"status": "no_group", "preset": "balanced", "lo": 1, "hi": 2}'::jsonb,
  'Singles no group: the Mixed band (level 1-2)');

-- ---------------------------------------------------------------------------
-- What people see
-- ---------------------------------------------------------------------------
select pg_temp.session('pv', 'balanced', 'all_off', 'doubles', array['A:5','B:1','C:3','D:3']);
select is(public.queue_preview(pg_temp.sid('pv')) -> 'formats' -> 'doubles', '{"status": "no_group", "group": []}'::jsonb,
  'The preview: no group, no band');
select is(public.queue_preview(pg_temp.sid('pv')) ->> 'preset', 'balanced', 'The preview names the preset');

select * from finish();
rollback;
