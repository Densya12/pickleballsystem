-- Phase 7: members (RLS, member_id link), add_walk_in resend safety
-- (p_client_id), and the daily cleanup.
-- Run: npm run test:db   (needs the local stack: npx supabase start)
begin;
select plan(54);

create function pg_temp.as_user(p_sub uuid, p_extra jsonb default '{}') returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    (jsonb_build_object('sub', p_sub, 'role', 'authenticated') || p_extra)::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;
create function pg_temp.as_player(p_sub uuid) returns void language sql as $$
  select pg_temp.as_user(p_sub, '{"is_anonymous": true}');
$$;
create function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  perform set_config('role', 'anon', true);
end;
$$;
create function pg_temp.sid(p_key text) returns uuid language sql as $$
  select current_setting('test.' || p_key)::uuid;
$$;
create function pg_temp.err(p_sql text) returns text language plpgsql as $$
declare v_msg text; v_detail text; v_state text;
begin
  execute p_sql;
  return 'no error';
exception when others then
  get stacked diagnostics v_msg = message_text, v_detail = pg_exception_detail, v_state = returned_sqlstate;
  return case when v_state = 'P0001' then v_msg || coalesce(':' || nullif(v_detail, ''), '') else v_state end;
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, is_anonymous) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.com', false),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@example.com', false),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'organizer@example.com', false),
  ('77777777-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true);
insert into public.clubs (id, name, created_by) values
  ('ca000000-0000-0000-0000-000000000000', 'Member Club', '11111111-1111-1111-1111-111111111111'),
  ('cb000000-0000-0000-0000-000000000000', 'Other Club', '22222222-2222-2222-2222-222222222222');
insert into public.club_staff (club_id, user_id, role) values
  ('ca000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('ca000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'organizer'),
  ('cb000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'owner');

-- ===========================================================================
-- 1. members RLS: staff of the club only
-- ===========================================================================
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
insert into public.members (club_id, display_name, level, dues_status, notes)
values ('ca000000-0000-0000-0000-000000000000', '  Ana   Reyes ', 'advanced', 'paid', '   ');
select is((select row(display_name, level, dues_status, notes)::text from public.members where club_id = 'ca000000-0000-0000-0000-000000000000'),
  '("Ana Reyes",advanced,paid,)', 'The owner adds a member; the name is tidied and empty notes become null');
reset role;
select set_config('test.ana', (select id::text from public.members
  where club_id = 'ca000000-0000-0000-0000-000000000000' and display_name = 'Ana Reyes'), true);

select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
insert into public.members (club_id, display_name) values ('ca000000-0000-0000-0000-000000000000', 'Ben Cruz');
update public.members set dues_status = 'unpaid', notes = 'Tuwing Biyernes' where display_name = 'Ben Cruz';
select is((select row(level, dues_status, notes)::text from public.members where display_name = 'Ben Cruz'),
  '(unsure,unpaid,"Tuwing Biyernes")', 'An organizer (not owner) can add and edit members; defaults: unsure, none');
select is((select count(*)::int from public.members), 2, 'Staff read their club''s members');
reset role;

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
insert into public.members (club_id, display_name) values ('cb000000-0000-0000-0000-000000000000', 'Other Member');
select is((select count(*)::int from public.members), 1, 'Another club''s owner reads only their own members');
select throws_ok($$insert into public.members (club_id, display_name) values ('ca000000-0000-0000-0000-000000000000', 'Sneaky')$$,
  '42501', null, 'and cannot add to this club');
update public.members set notes = 'hacked' where club_id = 'ca000000-0000-0000-0000-000000000000';
reset role;
select is((select count(*)::int from public.members where notes = 'hacked'), 0, 'nor edit this club''s members');

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(pg_temp.err($$update public.members set club_id = 'cb000000-0000-0000-0000-000000000000' where display_name = 'Ben Cruz'$$),
  '42501', 'A member cannot be moved to another club');
select is(pg_temp.err($$delete from public.members where display_name = 'Ben Cruz'$$), '42501', 'Members are not deleted from the app');
select throws_ok($$insert into public.members (club_id, display_name, dues_status) values ('ca000000-0000-0000-0000-000000000000', 'Cara', 'maybe')$$,
  '23514', null, 'dues_status is paid, unpaid or none');
select throws_ok($$insert into public.members (club_id, display_name) values ('ca000000-0000-0000-0000-000000000000', 'C')$$,
  '23514', null, 'Names are 2 to 40 characters');
reset role;

-- A live session with a phone player, to check that players read nothing.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select set_config('test.s1', public.create_session('ca000000-0000-0000-0000-000000000000', 'Member Night', now(), now() + interval '3h', 1, p_fee => 150, p_start => true)::text, true);
reset role;
select set_config('test.code1', (select join_code from public.sessions where id = pg_temp.sid('s1')), true);
select pg_temp.as_player('77777777-0000-0000-0000-000000000001');
select set_config('test.pia', public.join_session(current_setting('test.code1'), 'Ana Reyes', 'intermediate')::text, true);
select is((select count(*)::int from public.members), 0, 'A player of the club''s session reads no members');
select throws_ok($$insert into public.members (club_id, display_name) values ('ca000000-0000-0000-0000-000000000000', 'Player Made')$$,
  '42501', null, 'and cannot add one');
reset role;
select pg_temp.as_anon();
select is(pg_temp.err('select count(*) from public.members'), '42501', 'Signed-out callers cannot read members at all');
reset role;

-- ===========================================================================
-- 2. save_player_as_member and the member_id link
-- ===========================================================================
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select set_config('test.walk', public.add_walk_in(pg_temp.sid('s1'), 'Dino Santos', 'beginner', 'later')::text, true);
select set_config('test.dino', public.save_player_as_member(pg_temp.sid('walk'))::text, true);
reset role;
select is((select row(m.display_name, m.level, m.dues_status, m.club_id)::text from public.members m where m.id = pg_temp.sid('dino')),
  '("Dino Santos",beginner,none,ca000000-0000-0000-0000-000000000000)', 'A new member is made from the player''s name and level');
select is((select member_id from public.session_players where id = pg_temp.sid('walk')), pg_temp.sid('dino'), 'and the player is linked to it');

-- Pia checked in as "Ana Reyes": same name as a member, so linking is offered.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(pg_temp.err(format('select public.save_player_as_member(%L)', pg_temp.sid('pia'))),
  'member_exists:' || current_setting('test.ana'), 'Same name (any case): member_exists, with the existing member''s id');
select is(public.save_player_as_member(pg_temp.sid('pia'), pg_temp.sid('ana')), pg_temp.sid('ana'), 'Linking to the existing member');
reset role;
select is((select member_id from public.session_players where id = pg_temp.sid('pia')), pg_temp.sid('ana'), 'Pia is linked to Ana Reyes');
select is((select count(*)::int from public.members where club_id = 'ca000000-0000-0000-0000-000000000000' and lower(display_name) = 'ana reyes'), 1,
  'No duplicate was made');

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select set_config('test.ana2', public.save_player_as_member(pg_temp.sid('pia'), p_create_new => true)::text, true);
reset role;
select is((select count(*)::int from public.members where club_id = 'ca000000-0000-0000-0000-000000000000' and lower(display_name) = 'ana reyes'), 2,
  '"Gumawa ng bago" makes a second member with that name when asked');
select is((select member_id from public.session_players where id = pg_temp.sid('pia')), pg_temp.sid('ana2'), 'and links to it');

select set_config('test.other_member', (select id::text from public.members
  where club_id = 'cb000000-0000-0000-0000-000000000000' and display_name = 'Other Member'), true);
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(pg_temp.err(format('select public.save_player_as_member(%L, %L)', pg_temp.sid('walk'), pg_temp.sid('other_member'))),
  'member_not_found', 'Another club''s member cannot be linked');
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select is(pg_temp.err(format('select public.save_player_as_member(%L)', pg_temp.sid('walk'))), 'player_not_found',
  'Another club''s staff cannot save this club''s players');
select pg_temp.as_player('77777777-0000-0000-0000-000000000001');
select is(pg_temp.err(format('select public.save_player_as_member(%L)', pg_temp.sid('pia'))), '42501',
  'A player cannot save themselves as a member');
reset role;

-- member_id is a real foreign key, set to null when the member is deleted (history stays).
select throws_ok(format('update public.session_players set member_id = gen_random_uuid() where id = %L', pg_temp.sid('walk')),
  '23503', null, 'member_id must point to a member');
delete from public.members where id = pg_temp.sid('dino');
select is((select row(display_name, member_id)::text from public.session_players where id = pg_temp.sid('walk')),
  '("Dino Santos",)', 'Deleting a member keeps the player row and clears member_id');

-- ===========================================================================
-- 3. add_walk_in: p_client_id makes a resend safe; p_member_id links a regular
-- ===========================================================================
select set_config('test.client1', gen_random_uuid()::text, true);
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select set_config('test.w1', public.add_walk_in(pg_temp.sid('s1'), 'Ella Go', 'beginner', 'cash_received', null, pg_temp.sid('client1'))::text, true);
select is(public.add_walk_in(pg_temp.sid('s1'), 'Ella Go', 'beginner', 'cash_received', null, pg_temp.sid('client1')), pg_temp.sid('w1'),
  'The same client id returns the same player');
select is(public.add_walk_in(pg_temp.sid('s1'), 'Different Name', 'advanced', 'later', null, pg_temp.sid('client1')), pg_temp.sid('w1'),
  'even if the resend differs (the first one wins)');
reset role;
select is((select count(*)::int from public.session_players where session_id = pg_temp.sid('s1') and client_id = pg_temp.sid('client1')), 1,
  'Only one player for that client id');
select is((select count(*)::int from public.events where payload ->> 'player_id' = current_setting('test.w1')), 1,
  'The payment was recorded once (one event)');
select is((select row(display_name, payment_status)::text from public.session_players where id = pg_temp.sid('w1')),
  '("Ella Go",confirmed)', 'The first walk-in is unchanged');

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select isnt(public.add_walk_in(pg_temp.sid('s1'), 'Ella Go', 'beginner', 'later', null, gen_random_uuid()), pg_temp.sid('w1'),
  'A different client id is a different walk-in');
select isnt(public.add_walk_in(pg_temp.sid('s1'), 'Fely Lim', 'beginner', 'later'), null, 'No client id: works as before');
select set_config('test.m1', public.add_walk_in(pg_temp.sid('s1'), 'Ana Reyes', 'advanced', 'later', null, null, pg_temp.sid('ana'))::text, true);
reset role;
select is((select member_id from public.session_players where id = pg_temp.sid('m1')), pg_temp.sid('ana'), 'A walk-in picked from members is linked');
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(pg_temp.err(format('select public.add_walk_in(%L, %L, %L, ''later'', null, null, %L)', pg_temp.sid('s1'), 'X Y', 'unsure', pg_temp.sid('other_member'))),
  'member_not_found', 'Another club''s member cannot be used');
select is(pg_temp.err('select client_id from public.session_players'), '42501', 'client_id is not readable by clients');
reset role;

-- Same client id in another session is a separate walk-in (unique per session).
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select set_config('test.s2', public.create_session('cb000000-0000-0000-0000-000000000000', 'Other Night', now(), now() + interval '3h', 1, p_start => true)::text, true);
select isnt(public.add_walk_in(pg_temp.sid('s2'), 'Ella Go', 'beginner', 'later', null, pg_temp.sid('client1')), pg_temp.sid('w1'),
  'The same client id in another session is its own walk-in');
reset role;
select throws_ok(format('insert into public.session_players (session_id, display_name, client_id) values (%L, %L, %L)',
                        pg_temp.sid('s1'), 'Dup', pg_temp.sid('client1')),
  '23505', null, 'The database refuses a second row with the same client id in a session');

-- ===========================================================================
-- 4. Cleanup: old inactive anonymous users and orphan change counters
-- ===========================================================================
insert into auth.users (id, instance_id, aud, role, email, is_anonymous, created_at, last_sign_in_at) values
  -- deleted: old, nothing
  ('88888888-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, now() - interval '40 days', now() - interval '40 days'),
  -- deleted: old, only a left row in an ended session (history stays)
  ('88888888-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, now() - interval '40 days', null),
  -- kept: old, but in line right now in a live session
  ('88888888-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, now() - interval '40 days', null),
  -- kept: recent
  ('88888888-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, now() - interval '5 days', null),
  -- kept: an organizer, however old
  ('88888888-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'old@example.com', false, now() - interval '400 days', null),
  -- kept: old account, but checked in a week ago (a regular)
  ('88888888-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, now() - interval '90 days', null),
  -- deleted: old, and their row in the live session is 'left'
  ('88888888-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, now() - interval '40 days', null),
  -- kept: old account, signed in recently
  ('88888888-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, now() - interval '60 days', now() - interval '2 days');

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select public.end_session(pg_temp.sid('s2'));
reset role;
insert into public.session_players (id, session_id, display_name, user_id, status, created_at) values
  ('99999999-0000-0000-0000-000000000002', pg_temp.sid('s2'), 'Old Ended', '88888888-0000-0000-0000-000000000002', 'left', now() - interval '35 days'),
  ('99999999-0000-0000-0000-000000000003', pg_temp.sid('s1'), 'Old Live', '88888888-0000-0000-0000-000000000003', 'queued', now() - interval '35 days'),
  ('99999999-0000-0000-0000-000000000006', pg_temp.sid('s2'), 'Weekly Regular', '88888888-0000-0000-0000-000000000006', 'left', now() - interval '7 days'),
  ('99999999-0000-0000-0000-000000000007', pg_temp.sid('s1'), 'Old Left', '88888888-0000-0000-0000-000000000007', 'left', now() - interval '35 days');

insert into private.session_changes (session_id, counter) values (gen_random_uuid(), 3), (pg_temp.sid('s1'), 7)
on conflict (session_id) do update set counter = 7;

select set_config('test.cleanup', private.cleanup_stale_data()::text, true);
select ok((current_setting('test.cleanup')::jsonb ->> 'anonymous_users_deleted')::int >= 3, 'cleanup reports the deleted users');
select ok((current_setting('test.cleanup')::jsonb ->> 'session_changes_deleted')::int >= 1, 'and the deleted counters');

select is((select count(*)::int from auth.users where id in ('88888888-0000-0000-0000-000000000001', '88888888-0000-0000-0000-000000000002', '88888888-0000-0000-0000-000000000007')), 0,
  'Old anonymous users with no live row are deleted (none, ended-only, left in the live session)');
select ok(exists (select 1 from auth.users where id = '88888888-0000-0000-0000-000000000003'), 'Kept: old, but in line in a live session');
select ok(exists (select 1 from auth.users where id = '88888888-0000-0000-0000-000000000004'), 'Kept: a recent player');
select ok(exists (select 1 from auth.users where id = '88888888-0000-0000-0000-000000000005'), 'Kept: an organizer account');
select ok(exists (select 1 from auth.users where id = '88888888-0000-0000-0000-000000000006'), 'Kept: an old account that checked in last week');
select ok(exists (select 1 from auth.users where id = '88888888-0000-0000-0000-000000000008'), 'Kept: an old account that signed in recently');
select ok(exists (select 1 from auth.users where id = '11111111-1111-1111-1111-111111111111')
          and exists (select 1 from auth.users where id = '77777777-0000-0000-0000-000000000001'),
  'Kept: the club owner and the recent player from above');
select is((select row(display_name, user_id)::text from public.session_players where id = '99999999-0000-0000-0000-000000000002'),
  '("Old Ended",)', 'History stays: the player row remains, without the user id');
select is((select count(*)::int from public.session_players where id in ('99999999-0000-0000-0000-000000000002', '99999999-0000-0000-0000-000000000007')), 2,
  'Both history rows remain');

select is((select count(*)::int from private.session_changes c where not exists (select 1 from public.sessions s where s.id = c.session_id)), 0,
  'Change counters of deleted sessions are removed');
-- (Clearing user_id on history rows is a change, so the live session's counter moved on.)
select ok((select counter from private.session_changes where session_id = pg_temp.sid('s1')) >= 7, 'Counters of existing sessions are kept');

select is(private.cleanup_stale_data(), '{"anonymous_users_deleted": 0, "session_changes_deleted": 0}'::jsonb, 'Running it again deletes nothing');

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(pg_temp.err('select private.cleanup_stale_data()'), '42501', 'Clients cannot run the cleanup');
reset role;

select is((select count(*)::int from cron.job where jobname = 'opq-daily-cleanup' and schedule = '0 19 * * *'
           and command = 'select private.cleanup_stale_data()'), 1, 'It is scheduled daily at 03:00 Manila (19:00 UTC) with pg_cron');

select * from finish();
rollback;
