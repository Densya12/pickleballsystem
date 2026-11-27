-- D26 follow-up: a staying winner can sit out the next game (public.sit_out).
-- The player for themselves, staff for anyone; live session; only while
-- staying; idempotent. The pair is broken (streak 0); Call fills the free
-- spots with the D25 selection around any remaining stayer.
-- Run: npm run test:db   (needs the local stack: npx supabase start)
begin;
select plan(26);

create function pg_temp.as_user(p_sub uuid, p_extra jsonb default '{}') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', (jsonb_build_object('sub', p_sub, 'role', 'authenticated') || p_extra)::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;
create function pg_temp.as_owner() returns void language sql as $$ select pg_temp.as_user('11111111-1111-1111-1111-111111111111') $$;
create function pg_temp.as_player() returns void language sql as $$ select pg_temp.as_user('77777777-0000-0000-0000-000000000001', '{"is_anonymous": true}') $$;
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
create function pg_temp.names(p_ids uuid[]) returns text language sql as $$
  select string_agg(substr(p.display_name, 3), ',' order by substr(p.display_name, 3)) from unnest(p_ids) u(id) join public.session_players p on p.id = u.id;
$$;
create function pg_temp.session(p_key text, p_preset text, p_players text[]) returns void language plpgsql as $$
declare v_s uuid; v_p text;
begin
  perform public.end_session(s.id) from public.sessions s where s.club_id = 'c9700000-0000-0000-0000-000000000000' and s.status = 'live';
  v_s := public.create_session('c9700000-0000-0000-0000-000000000000', 'Sit ' || p_key, now(), now() + interval '3h',
                               1, 11, 'winners_stay', false, 0, true, array['doubles']);
  perform public.set_session_call_mode(v_s, 'wait');
  perform public.set_session_matchmaking(v_s, p_preset);
  foreach v_p in array p_players loop
    perform public.add_walk_in(v_s, 'P ' || split_part(v_p, ':', 1), coalesce(nullif(split_part(v_p, ':', 2), ''), 'unsure'));
  end loop;
  perform set_config('test.' || p_key, v_s::text, true);
end;
$$;
-- The current game's first team (positions 1-2) win; they stay (Wait for me).
create function pg_temp.team1_wins(p_s uuid) returns uuid[] language plpgsql as $$
declare v_team uuid[];
begin
  select g.player_ids[1:2] into v_team from public.games g where g.id = pg_temp.game(p_s);
  perform public.finish_game(pg_temp.court(p_s), pg_temp.game(p_s), v_team);
  return v_team;
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, is_anonymous) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.com', false),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@example.com', false),
  ('77777777-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true);
insert into public.clubs (id, name, created_by) values
  ('c9700000-0000-0000-0000-000000000000', 'Sit Club', '11111111-1111-1111-1111-111111111111'),
  ('c9800000-0000-0000-0000-000000000000', 'Other Club', '22222222-2222-2222-2222-222222222222');
insert into public.club_staff (club_id, user_id, role) values
  ('c9700000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('c9800000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'owner');
select pg_temp.as_owner();

-- ---------------------------------------------------------------------------
-- The player sits out; Call fills 3 with the level rule (Mixed: levels within 1)
-- ---------------------------------------------------------------------------
select pg_temp.session('m', 'mixed', array['A:3','B:3','C:3','D:3','E:4','F:3','G:5','H:3','I:2']);
select public.call_next(pg_temp.court(pg_temp.sid('m')));
create temporary table m_win as select pg_temp.team1_wins(pg_temp.sid('m')) as ids;
grant select on m_win to authenticated;
-- The first winner is the anonymous player's own check-in.
reset role;
update public.session_players set user_id = '77777777-0000-0000-0000-000000000001' where id = (select ids[1] from m_win);
select pg_temp.as_owner();
select is((select winner_streak from public.courts where id = pg_temp.court(pg_temp.sid('m'))), 1, 'Setup: the winners stay with a streak of 1');

select pg_temp.as_player();
select is(pg_temp.err(format('select public.sit_out(%L)', (select ids[2] from m_win))), 'player_not_found',
  'A player cannot send someone else to the line');
select is(public.sit_out((select ids[1] from m_win)), pg_temp.court(pg_temp.sid('m')), 'The player sits out themselves (returns the court)');
select pg_temp.as_owner();
select is((select status from public.session_players where id = (select ids[1] from m_win)), 'queued', 'They are back in line (queued)');
select is((select max(queue_pos) from public.session_players where session_id = pg_temp.sid('m') and status = 'queued'),
          (select queue_pos from public.session_players where id = (select ids[1] from m_win)), 'At the back of the line');
select is((select staying_ids from public.courts where id = pg_temp.court(pg_temp.sid('m'))), array[(select ids[2] from m_win)],
  'The other winner keeps staying');
select is((select winner_streak from public.courts where id = pg_temp.court(pg_temp.sid('m'))), 0, 'The pair is broken: the streak resets to 0');
select is((select payload - 'court_id' from public.events where session_id = pg_temp.sid('m') and type = 'sat_out'),
  jsonb_build_object('player_id', (select ids[1] from m_win), 'by', 'player'), 'Logged: who sat out, and by whom');
select is((select actor from public.events where session_id = pg_temp.sid('m') and type = 'sat_out'),
  '77777777-0000-0000-0000-000000000001'::uuid, 'Logged with the actor');
select is(pg_temp.err(format('select public.undo_last(%L)', pg_temp.sid('m'))), 'undo_not_available', 'Not undoable (the Done before it can''t be undone either)');

-- Idempotent: a second tap (or an outbox resend) changes nothing.
create temporary table m_pos as select queue_pos from public.session_players where id = (select ids[1] from m_win);
select pg_temp.as_player();
select is(public.sit_out((select ids[1] from m_win)), pg_temp.court(pg_temp.sid('m')), 'Idempotent: sitting out again returns the same court');
select pg_temp.as_owner();
select ok((select queue_pos = (select queue_pos from m_pos) from public.session_players where id = (select ids[1] from m_win))
          and (select count(*) from public.events where session_id = pg_temp.sid('m') and type = 'sat_out') = 1,
  'Idempotent: same place in line, one event');

-- Only while staying.
select is(pg_temp.err(format('select public.sit_out(%L)', pg_temp.pid(pg_temp.sid('m'), 'G'))), 'player_not_staying', 'Someone waiting in line is not staying');
-- Another club's organizer is refused.
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select is(pg_temp.err(format('select public.sit_out(%L)', (select ids[2] from m_win))), 'player_not_found', 'Staff of another club are refused');
select pg_temp.as_owner();

-- Call fills 3 around the remaining stayer (level 3), with the level rule:
-- E (4) is first in line; F and H (3) fit; G (5) is passed over.
select is(jsonb_array_length(public.queue_preview(pg_temp.sid('m')) -> 'courts' -> pg_temp.court(pg_temp.sid('m'))::text -> 'group'), 3,
  'Preview: Call on the court will add 3');
select public.call_next(pg_temp.court(pg_temp.sid('m')));
select is((select pg_temp.names(player_ids) from public.games where id = pg_temp.game(pg_temp.sid('m'))),
          pg_temp.names(array[(select ids[2] from m_win), pg_temp.pid(pg_temp.sid('m'), 'E'), pg_temp.pid(pg_temp.sid('m'), 'F'), pg_temp.pid(pg_temp.sid('m'), 'H')]),
  'Call fills 3 spots with the D25 selection (level rule), the stayer as the fixed member');
select is((select stayed_ids from public.games where id = pg_temp.game(pg_temp.sid('m'))), array[(select ids[2] from m_win)],
  'The new game records the one stayer');
select is((select skip_count from public.session_players where id = pg_temp.pid(pg_temp.sid('m'), 'G')), 1, 'G (level 5) was passed over');
select is(pg_temp.err(format('select public.sit_out(%L)', (select ids[2] from m_win))), 'player_not_staying', 'Once the game starts nobody is staying');
-- The streak starts over: winning this game counts as the first win.
select pg_temp.team1_wins(pg_temp.sid('m'));
select is((select winner_streak from public.courts where id = pg_temp.court(pg_temp.sid('m'))), 1, 'After the broken pair, the next win is a streak of 1');

-- ---------------------------------------------------------------------------
-- Staff sends both to the line: the court is simply empty and waiting
-- ---------------------------------------------------------------------------
select pg_temp.session('b', 'fair_line', array['A','B','C','D','E','F','G','H']);
select public.call_next(pg_temp.court(pg_temp.sid('b')));
create temporary table b_win as select pg_temp.team1_wins(pg_temp.sid('b')) as ids;
select is(public.sit_out((select ids[1] from b_win)), pg_temp.court(pg_temp.sid('b')), 'Staff send a staying winner to the line');
select public.sit_out((select ids[2] from b_win));
select ok((select cardinality(staying_ids) = 0 and current_game_id is null and waiting_since is not null and winner_streak = 0
           from public.courts where id = pg_temp.court(pg_temp.sid('b'))),
  'Both sat out: the court is empty and still waiting for Call');
select is((select payload ->> 'by' from public.events where session_id = pg_temp.sid('b') and type = 'sat_out' order by created_at desc, id desc limit 1),
  'staff', 'Logged as sent by staff');
select is((select string_agg(substr(p.display_name, 3), ',' order by p.queue_pos) from public.session_players p
           where p.session_id = pg_temp.sid('b') and p.id = any ((select ids from b_win)::uuid[])),
          (select string_agg(substr(p.display_name, 3), ',' order by array_position((select ids from b_win), p.id)) from public.session_players p
           where p.id = any ((select ids from b_win)::uuid[])),
  'They go to the back in the order they were sent');
select public.call_next(pg_temp.court(pg_temp.sid('b')));
select is((select cardinality(stayed_ids) from public.games where id = pg_temp.game(pg_temp.sid('b'))), 0, 'Call then calls a fresh 4');

-- Live sessions only.
select pg_temp.team1_wins(pg_temp.sid('b'));
create temporary table b_win2 as select staying_ids as ids from public.courts where id = pg_temp.court(pg_temp.sid('b'));
select public.end_session(pg_temp.sid('b'));
select is(pg_temp.err(format('select public.sit_out(%L)', (select ids[1] from b_win2))), 'session_not_live', 'Only in a live session');

select * from finish();
rollback;
