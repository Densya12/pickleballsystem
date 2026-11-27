-- Phase 9.1b: the organizer calls the next game (spec D26).
--
-- A session setting, call_mode: 'auto_call' (today: Done calls the next group
-- at once) or 'wait' ("Wait for me": Done finishes the game, the court waits,
-- and the organizer taps Call). Clubs get a default. Existing sessions and
-- club defaults stay auto_call, and the column defaults stay auto_call, so the
-- deployed app (which only knows auto-call) keeps working until merge.
--
-- Winners stay under "Wait for me": the staying winners remain on the court in
-- courts.staying_ids (status 'playing', so nobody else can be called onto
-- their spots, and they are never called elsewhere); Call fills the other
-- side. courts.waiting_since is when the court started waiting (the "Ready
-- to call" highlight). Both are new columns the deployed app never reads, and
-- they are only ever set for "Wait for me" sessions.
--
-- Backward compatible: every existing function keeps its name, signature,
-- grants, SECURITY DEFINER and search_path = ''.

-- ===========================================================================
-- 1. THE SETTING
-- ===========================================================================

alter table public.sessions add column if not exists call_mode text not null default 'auto_call';
alter table public.clubs add column if not exists default_call_mode text not null default 'auto_call';
alter table public.sessions drop constraint if exists sessions_call_mode_allowed;
alter table public.sessions add constraint sessions_call_mode_allowed check (call_mode in ('auto_call', 'wait'));
alter table public.clubs drop constraint if exists clubs_default_call_mode_allowed;
alter table public.clubs add constraint clubs_default_call_mode_allowed check (default_call_mode in ('auto_call', 'wait'));

alter table public.courts add column if not exists staying_ids uuid[] not null default '{}';
alter table public.courts add column if not exists waiting_since timestamptz;

grant select (call_mode) on public.sessions to authenticated;
grant select (default_call_mode), update (default_call_mode) on public.clubs to authenticated;
grant select (staying_ids, waiting_since) on public.courts to authenticated;

-- Same signature; new sessions take the club's default call mode (and, as
-- before, its default matchmaking).
create or replace function public.create_session(
  p_club_id uuid,
  p_name text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_courts_count integer,
  p_points_to integer default null,
  p_rotation text default null,
  p_pay_first boolean default false,
  p_fee integer default null,
  p_start boolean default false,
  p_court_formats text[] default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.assert_organizer_account();
  v_club public.clubs%rowtype;
  v_session_id uuid;
  v_constraint text;
  v_attempt integer := 0;
begin
  if p_club_id is null or not public.is_club_staff(p_club_id) then
    raise exception 'not_staff' using errcode = '42501';
  end if;

  select * into v_club from public.clubs c where c.id = p_club_id;

  -- Join codes come from a ~887M space; retry the rare collision.
  loop
    begin
      insert into public.sessions (
        club_id, name, starts_at, ends_at, courts_count, court_formats, points_to, rotation,
        pay_first, fee, gcash_name, gcash_number, created_by, matchmaking, call_mode
      ) values (
        p_club_id, p_name, p_starts_at, p_ends_at, p_courts_count, p_court_formats,
        coalesce(p_points_to, v_club.default_points),
        coalesce(p_rotation, v_club.default_rotation),
        coalesce(p_pay_first, false),
        coalesce(p_fee, v_club.default_fee),
        v_club.gcash_name, v_club.gcash_number, v_uid,
        v_club.default_matchmaking,
        v_club.default_call_mode
      )
      returning id into v_session_id;
      exit;
    exception
      when unique_violation then
        get stacked diagnostics v_constraint = constraint_name;
        v_attempt := v_attempt + 1;
        if v_constraint not in ('sessions_join_code_key', 'sessions_display_token_key')
           or v_attempt >= 5 then
          raise;
        end if;
    end;
  end loop;

  if coalesce(p_start, false) then
    perform private.session_go_live(v_session_id);
  end if;

  return v_session_id;
end;
$$;

-- New session form (draft or live) and More (while live), like
-- set_session_matchmaking / set_session_rotation: organizer-only, logged,
-- idempotent (safe to resend from the outbox). Takes effect at the next Done;
-- a court already waiting keeps waiting for Call.
create or replace function public.set_session_call_mode(p_session_id uuid, p_call_mode text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.sessions%rowtype;
begin
  perform private.assert_organizer_account();
  v_session := private.lock_staff_session(p_session_id);
  if v_session.status not in ('draft', 'live') then
    raise exception 'session_not_live' using errcode = 'P0001';
  end if;
  if p_call_mode is null or p_call_mode not in ('auto_call', 'wait') then
    raise exception 'invalid_call_mode' using errcode = 'P0001';
  end if;
  if v_session.call_mode = p_call_mode then
    return;
  end if;

  update public.sessions set call_mode = p_call_mode where id = p_session_id;
  insert into public.events (session_id, actor, type, payload)
  values (p_session_id, auth.uid(), 'call_mode_changed',
          jsonb_build_object('from', v_session.call_mode, 'to', p_call_mode));
end;
$$;

revoke execute on function public.set_session_call_mode(uuid, text) from public, anon, authenticated;
grant execute on function public.set_session_call_mode(uuid, text) to authenticated;

-- ===========================================================================
-- 2. A GAME STARTS: the court stops waiting
-- ===========================================================================

create or replace function private.launch_game(p_court_id uuid, p_session_id uuid, p_newcomers uuid[], p_stayed uuid[], p_note jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_number integer;
  v_game_id uuid;
  v_players uuid[] := private.order_teams(p_session_id, coalesce(p_stayed, '{}') || coalesce(p_newcomers, '{}'), p_stayed);
begin
  select coalesce(max(g.number), 0) + 1 into v_number from public.games g where g.session_id = p_session_id;

  insert into public.games (session_id, court_id, number, player_ids, format, stayed_ids, call_note)
  select p_session_id, p_court_id, v_number, v_players, c.format, coalesce(p_stayed, '{}'), p_note
  from public.courts c where c.id = p_court_id
  returning id into v_game_id;

  update public.session_players set status = 'playing', not_ready_at = null, skip_count = 0 where id = any (v_players);
  update public.courts set current_game_id = v_game_id, staying_ids = '{}', waiting_since = null where id = p_court_id;
  return v_game_id;
end;
$$;

-- ===========================================================================
-- 3. DONE: auto-call (today) or wait for the organizer
-- ===========================================================================

create or replace function private.finish_game_rotate(p_court_id uuid, p_game_id uuid, p_winner_ids uuid[])
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_court public.courts%rowtype;
  v_rotation text;
  v_wait boolean;
  v_game public.games%rowtype;
  v_needed integer;
  v_winners uuid[];
  v_losers uuid[];
  v_streak integer;
  v_res jsonb;
begin
  v_court := private.lock_live_court(p_court_id);
  select s.rotation, s.call_mode = 'wait' into v_rotation, v_wait from public.sessions s where s.id = v_court.session_id;

  select * into v_game from public.games g where g.id = p_game_id and g.court_id = p_court_id;
  if not found then
    raise exception 'game_not_found' using errcode = 'P0001';
  end if;
  if v_game.ended_at is not null or v_court.current_game_id is distinct from v_game.id then
    raise exception 'game_already_finished' using errcode = 'P0001';
  end if;

  v_needed := private.winners_needed(v_game.format);
  if p_winner_ids is not null then
    if cardinality(p_winner_ids) <> v_needed or not private.uuids_distinct(p_winner_ids)
       or not (p_winner_ids <@ v_game.player_ids) then
      raise exception 'invalid_winners' using errcode = 'P0001';
    end if;
  elsif v_rotation = 'winners_stay' then
    raise exception 'invalid_winners' using errcode = 'P0001';
  end if;

  update public.games set ended_at = now(), winner_ids = p_winner_ids where id = v_game.id;
  update public.session_players set games_played = games_played + 1 where id = any (v_game.player_ids);
  update public.courts set current_game_id = null where id = p_court_id;
  -- D26: under "Wait for me" the court waits from now (nothing below calls).
  if v_wait then
    update public.courts set waiting_since = now(), staying_ids = '{}' where id = p_court_id;
  end if;

  if v_rotation = 'all_off' then
    perform private.requeue(v_game.player_ids);
    update public.courts set winner_streak = 0 where id = p_court_id;
    if v_wait then
      return null;
    end if;
    return private.try_call(p_court_id, v_court.session_id);
  end if;

  v_winners := array(
    select p from unnest(v_game.player_ids) with ordinality u(p, i) where p = any (p_winner_ids) order by i
  );
  v_losers := array(
    select p from unnest(v_game.player_ids) with ordinality u(p, i) where p <> all (p_winner_ids) order by i
  );

  -- D23: fewer than 2 waiting: everyone goes off, losers first, so a winner sits out.
  if cardinality(private.next_eligible(v_court.session_id, 2)) < 2 then
    perform private.requeue(v_losers || v_winners);
    update public.courts set winner_streak = 0 where id = p_court_id;
    if v_wait then
      return null;
    end if;
    return private.try_call(p_court_id, v_court.session_id);
  end if;

  -- BR11 streak: the winners are the players who stayed on for this game.
  -- Games started before Phase 9 have no stayed_ids: they used positions
  -- (the staying winners were called first).
  v_streak := case
    when v_court.winner_streak > 0
         and (case when v_game.stayed_ids is null then v_winners @> v_game.player_ids[1:v_needed]
                   else cardinality(v_game.stayed_ids) > 0 and v_winners @> v_game.stayed_ids end)
      then v_court.winner_streak + 1
    else 1
  end;

  -- BR11: second win in a row: all go off (winners first) and the next group is called.
  if v_streak >= 2 then
    perform private.requeue(v_winners || v_losers);
    update public.courts set winner_streak = 0 where id = p_court_id;
    if v_wait then
      return null;
    end if;
    return private.try_call(p_court_id, v_court.session_id);
  end if;

  perform private.requeue(v_losers);

  if v_wait then
    -- D26: the winners stay on the court (still 'playing', so nobody else is
    -- called onto their spots) and the streak is kept for when Call starts
    -- their next game (its stayed_ids are these winners, so BR11 counts it).
    update public.courts set staying_ids = v_winners, winner_streak = v_streak where id = p_court_id;
    return null;
  end if;

  -- D25 (g): the winners are the group's fixed members; the newcomers must fit
  -- the level rule with them (variety applies to the newcomers).
  v_res := private.select_group(v_court.session_id, v_game.format, v_winners);
  if v_res ->> 'status' <> 'ok' then
    -- No newcomers fit with the winners: they can't stay. They go to the back
    -- (after the losers) and a fresh group is called if one fits.
    perform private.requeue(v_winners);
    update public.courts set winner_streak = 0 where id = p_court_id;
    return private.try_call(p_court_id, v_court.session_id);
  end if;

  perform private.apply_skips(v_res);
  update public.courts set winner_streak = v_streak where id = p_court_id;
  return private.launch_game(
    p_court_id, v_court.session_id, private.uuids_of(v_res -> 'group'), v_winners,
    private.call_note(v_res, jsonb_build_object('stayed', true))
  );
end;
$$;

-- Undo needs the court's waiting state too (snapshots from before this
-- migration have none: undo_last treats that as "not waiting").
create or replace function public.finish_game(p_court_id uuid, p_game_id uuid, p_winner_ids uuid[] default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_court public.courts%rowtype;
  v_players jsonb;
  v_next uuid;
begin
  perform private.assert_organizer_account();
  v_court := private.lock_live_court(p_court_id);

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'status', p.status, 'queue_pos', p.queue_pos,
           'games_played', p.games_played, 'not_ready_at', p.not_ready_at, 'skip_count', p.skip_count)), '[]'::jsonb)
  into v_players
  from public.session_players p
  where p.session_id = v_court.session_id and p.status <> 'left';

  v_next := private.finish_game_rotate(p_court_id, p_game_id, p_winner_ids);

  perform private.log_undoable(
    v_court.session_id,
    'game_finished',
    jsonb_build_object('court_id', p_court_id, 'game_id', p_game_id, 'next_game_id', v_next, 'winner_ids', to_jsonb(p_winner_ids)),
    jsonb_build_object(
      'court', jsonb_build_object(
        'current_game_id', v_court.current_game_id,
        'winner_streak', v_court.winner_streak,
        'staying_ids', to_jsonb(v_court.staying_ids),
        'waiting_since', v_court.waiting_since
      ),
      'players', v_players
    )
  );
  return v_next;
end;
$$;

create or replace function public.undo_last(p_session_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.sessions%rowtype;
  v_event public.events%rowtype;
  v_undo jsonb;
  v_court_id uuid;
  v_next uuid;
begin
  perform private.assert_organizer_account();
  v_session := private.lock_staff_session(p_session_id);

  select * into v_event
  from public.events e
  where e.session_id = p_session_id
  order by e.created_at desc, e.id desc
  limit 1;

  if not found
     or v_session.status = 'draft'
     or v_event.type not in ('game_finished', 'player_removed', 'payment_confirmed')
     or not (v_event.payload ? 'undo')
     or v_event.created_at < clock_timestamp() - interval '30 seconds'
     or (v_event.payload ->> 'change')::bigint <> private.session_change(p_session_id) then
    raise exception 'undo_not_available' using errcode = 'P0001';
  end if;

  v_undo := v_event.payload -> 'undo';

  if v_event.type = 'game_finished' then
    v_court_id := (v_event.payload ->> 'court_id')::uuid;
    v_next := (v_event.payload ->> 'next_game_id')::uuid;
    -- The next game goes away, the finished game runs again.
    update public.courts set current_game_id = null where id = v_court_id;
    if v_next is not null then
      delete from public.games where id = v_next;
    end if;
    update public.games set ended_at = null, winner_ids = null where id = (v_event.payload ->> 'game_id')::uuid;
    update public.courts
    set current_game_id = (v_undo -> 'court' ->> 'current_game_id')::uuid,
        winner_streak = (v_undo -> 'court' ->> 'winner_streak')::integer,
        -- D26: the court as it was (staying winners and waiting cleared while its game ran).
        staying_ids = private.uuids_of(v_undo -> 'court' -> 'staying_ids'),
        waiting_since = (v_undo -> 'court' ->> 'waiting_since')::timestamptz
    where id = v_court_id;
    update public.session_players p
    set status = x.status, queue_pos = x.queue_pos, games_played = x.games_played, not_ready_at = x.not_ready_at,
        skip_count = coalesce(x.skip_count, p.skip_count)
    from jsonb_to_recordset(v_undo -> 'players')
         as x(id uuid, status text, queue_pos bigint, games_played integer, not_ready_at timestamptz, skip_count integer)
    where p.id = x.id;

  elsif v_event.type = 'player_removed' then
    update public.session_players
    set status = v_undo ->> 'status', not_ready_at = (v_undo ->> 'not_ready_at')::timestamptz
    where id = (v_event.payload ->> 'player_id')::uuid;

  else
    update public.payments
    set status = v_undo ->> 'payment_status',
        method = v_undo ->> 'method',
        reference_digits = v_undo ->> 'reference_digits',
        amount = (v_undo ->> 'amount')::integer,
        updated_by = auth.uid(),
        updated_at = now()
    where session_player_id = (v_event.payload ->> 'player_id')::uuid;
    update public.session_players set payment_status = v_undo ->> 'payment_status'
    where id = (v_event.payload ->> 'player_id')::uuid;
  end if;

  -- Also the session's latest event now, so the same action can't be undone twice (BR16: who, when).
  insert into public.events (session_id, actor, type, payload)
  values (p_session_id, auth.uid(), 'undo', jsonb_build_object(
    'undone_event_id', v_event.id,
    'undone_type', v_event.type,
    'player_id', v_event.payload -> 'player_id',
    'game_id', v_event.payload -> 'game_id'
  ));

  return v_event.type;
end;
$$;

-- ===========================================================================
-- 4. CALL: the same selection (D25), filling the side next to any stayers
-- ===========================================================================

-- D23 at Call time: with staying winners and fewer than 2 waiting, everyone
-- goes off (the losers are already ahead in the queue) and a fresh group is
-- called. Returns the staying players still on the court.
-- Used by Call mixed (levels are ignored there, so only D23 applies);
-- Call uses private.call_selection (D23 and D25 g).
create or replace function private.release_stayers_if_few(p_court public.courts)
returns uuid[]
language plpgsql
set search_path = ''
as $$
begin
  if cardinality(p_court.staying_ids) = 0 then
    return '{}';
  end if;
  if cardinality(private.next_eligible(p_court.session_id, 2)) < 2 then
    perform private.requeue(p_court.staying_ids);
    update public.courts set staying_ids = '{}', winner_streak = 0 where id = p_court.id;
    return '{}';
  end if;
  return p_court.staying_ids;
end;
$$;

-- What Call does on a court, as auto-call does at Done (D25 g, D23): with
-- staying winners, the newcomers must fit the level rule with them; if fewer
-- than 2 wait, or no newcomers fit, the winners can't stay: they go to the back
-- and a fresh group is chosen. Read-only: returns the selection, whether the
-- winners go off ('release'), and the players who stay.
create or replace function private.call_selection(p_session_id uuid, p_format text, p_staying uuid[])
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_res jsonb;
begin
  if cardinality(coalesce(p_staying, '{}')) > 0 and cardinality(private.next_eligible(p_session_id, 2)) >= 2 then
    v_res := private.select_group(p_session_id, p_format, p_staying);
    if v_res ->> 'status' = 'ok' then
      return v_res || jsonb_build_object('release', false, 'staying', to_jsonb(p_staying));
    end if;
  end if;
  -- No stayers, or they go off: a fresh group (with them at the back of the queue,
  -- they can't be chosen ahead of anyone waiting; the window is the next 8).
  v_res := private.select_group(p_session_id, p_format, '{}');
  return v_res || jsonb_build_object('release', cardinality(coalesce(p_staying, '{}')) > 0, 'staying', '[]'::jsonb);
end;
$$;

create or replace function public.call_next(p_court_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_court public.courts%rowtype;
  v_stayed uuid[];
  v_res jsonb;
begin
  perform private.assert_organizer_account();
  v_court := private.lock_live_court(p_court_id);

  if v_court.current_game_id is not null then
    raise exception 'court_busy' using errcode = 'P0001';
  end if;

  v_stayed := v_court.staying_ids;
  if cardinality(v_stayed) > 0 and (private.call_selection(v_court.session_id, v_court.format, v_stayed) ->> 'release')::boolean then
    -- The winners can't stay (D23 or D25 g): to the back, and a fresh group.
    perform private.requeue(v_stayed);
    update public.courts set staying_ids = '{}', winner_streak = 0 where id = p_court_id;
    v_stayed := '{}';
  end if;
  v_res := private.select_group(v_court.session_id, v_court.format, v_stayed);
  if v_res ->> 'status' = 'not_enough' then
    raise exception 'not_enough_players' using errcode = 'P0001', detail = v_res ->> 'missing';
  end if;
  if v_res ->> 'status' = 'no_group' then
    -- D25: no group fits the level rule; the organizer can "Call mixed".
    raise exception 'no_level_group' using errcode = 'P0001',
      detail = coalesce((v_res ->> 'lo') || '-' || (v_res ->> 'hi'), '');
  end if;

  if cardinality(v_stayed) = 0 then
    update public.courts set winner_streak = 0 where id = p_court_id;
  end if;
  perform private.apply_skips(v_res);
  return private.launch_game(
    p_court_id, v_court.session_id, private.uuids_of(v_res -> 'group'), v_stayed,
    private.call_note(v_res, case when cardinality(v_stayed) > 0 then jsonb_build_object('stayed', true) else '{}'::jsonb end)
  );
end;
$$;

-- D25 (f) "Call mixed": the next eligible players in queue order, once,
-- ignoring level; next to any staying winners. Logged.
create or replace function public.call_mixed(p_court_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_court public.courts%rowtype;
  v_stayed uuid[];
  v_size integer;
  v_players uuid[];
  v_lo integer;
  v_hi integer;
begin
  perform private.assert_organizer_account();
  v_court := private.lock_live_court(p_court_id);
  if v_court.current_game_id is not null then
    raise exception 'court_busy' using errcode = 'P0001';
  end if;

  v_stayed := private.release_stayers_if_few(v_court);
  v_size := private.court_size(v_court.format) - cardinality(v_stayed);
  v_players := private.next_eligible(v_court.session_id, v_size);
  if cardinality(v_players) < v_size then
    raise exception 'not_enough_players' using errcode = 'P0001', detail = (v_size - cardinality(v_players))::text;
  end if;
  select min(p.skill), max(p.skill) into v_lo, v_hi from public.session_players p where p.id = any (v_players || v_stayed);

  insert into public.events (session_id, actor, type, payload)
  values (v_court.session_id, auth.uid(), 'mixed_call', jsonb_build_object('court_id', p_court_id, 'player_ids', to_jsonb(v_players)));

  if cardinality(v_stayed) = 0 then
    update public.courts set winner_streak = 0 where id = p_court_id;
  end if;
  return private.launch_game(
    p_court_id, v_court.session_id, v_players, v_stayed,
    jsonb_strip_nulls(jsonb_build_object('preset', (select s.matchmaking from public.sessions s where s.id = v_court.session_id),
                                         'lo', v_lo, 'hi', v_hi, 'mixed_call', true,
                                         'stayed', case when cardinality(v_stayed) > 0 then true end))
  );
end;
$$;

-- A court with staying winners isn't empty: its format can't change.
create or replace function public.set_court_format(p_court_id uuid, p_format text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_court public.courts%rowtype;
begin
  perform private.assert_organizer_account();
  v_court := private.lock_live_court(p_court_id);
  if v_court.current_game_id is not null or cardinality(v_court.staying_ids) > 0 then
    raise exception 'court_busy' using errcode = 'P0001';
  end if;
  if p_format is null or p_format not in ('doubles', 'singles') then
    raise exception 'invalid_format' using errcode = 'P0001';
  end if;
  update public.courts set format = p_format, winner_streak = 0 where id = p_court_id;
  -- Keep the session's plan in step with its courts.
  update public.sessions set court_formats[v_court.number] = p_format where id = v_court.session_id;
end;
$$;

create or replace function public.end_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.sessions%rowtype;
begin
  perform private.assert_organizer_account();
  v_session := private.lock_staff_session(p_session_id);
  if v_session.status <> 'live' then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  update public.games set ended_at = now() where session_id = p_session_id and ended_at is null;
  update public.courts set current_game_id = null, winner_streak = 0, staying_ids = '{}', waiting_since = null
  where session_id = p_session_id;
  update public.session_players set status = 'left', not_ready_at = null
  where session_id = p_session_id and status <> 'left';
  update public.sessions set status = 'ended', ended_at = now() where id = p_session_id;
end;
$$;

revoke execute on function private.release_stayers_if_few(public.courts) from public, anon, authenticated;
revoke execute on function private.call_selection(uuid, text, uuid[]) from public, anon, authenticated;

-- ===========================================================================
-- 5. PREVIEW: per court with staying winners, who Call would add
-- ===========================================================================

-- One preview entry: status, level range, and the group's names and levels (no payment data).
create or replace function private.preview_entry(p_res jsonb)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'status', p_res ->> 'status',
    'lo', p_res -> 'lo',
    'hi', p_res -> 'hi',
    'repeats', p_res -> 'repeats',
    'missing', p_res -> 'missing',
    'group', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name, 'skill', p.skill) order by g.ord), '[]'::jsonb)
              from unnest(private.uuids_of(p_res -> 'group')) with ordinality g(id, ord)
              join public.session_players p on p.id = g.id)
  ));
$$;

create or replace function public.queue_preview(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_session public.sessions%rowtype;
  v_result jsonb := '{}'::jsonb;
  v_courts jsonb := '{}'::jsonb;
  v_format text;
  v_court record;
  v_res jsonb;
begin
  if p_session_id is null or not (public.is_session_staff(p_session_id) or public.is_session_player(p_session_id)) then
    raise exception 'session_not_found' using errcode = 'P0001';
  end if;
  select * into v_session from public.sessions s where s.id = p_session_id;
  if v_session.status <> 'live' then
    return jsonb_build_object('preset', v_session.matchmaking, 'formats', '{}'::jsonb);
  end if;

  for v_format in select distinct c.format from public.courts c where c.session_id = p_session_id order by 1 loop
    v_res := private.select_group(p_session_id, v_format, '{}');
    v_result := v_result || jsonb_build_object(v_format, private.preview_entry(v_res));
  end loop;

  -- D26: a court with staying winners: the newcomers Call would add next to them,
  -- or (release: true) the fresh group when they go off at Call (D23, D25 g).
  for v_court in
    select c.id, c.format, c.staying_ids from public.courts c
    where c.session_id = p_session_id and cardinality(c.staying_ids) > 0 and c.current_game_id is null
  loop
    v_res := private.call_selection(p_session_id, v_court.format, v_court.staying_ids);
    v_courts := v_courts || jsonb_build_object(v_court.id::text,
      private.preview_entry(v_res) || jsonb_build_object('release', (v_res ->> 'release')::boolean));
  end loop;

  return jsonb_build_object('preset', v_session.matchmaking, 'formats', v_result, 'courts', v_courts);
end;
$$;

revoke execute on function private.preview_entry(jsonb) from public, anon, authenticated;
revoke execute on function public.queue_preview(uuid) from public, anon, authenticated;
grant execute on function public.queue_preview(uuid) to authenticated;
