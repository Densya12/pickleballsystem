-- Phase 5b: fewer steps (D18). No queue or payment rule changes here.
--
-- 1. clubs.entry_code: a permanent club QR (/c/<code>) that opens whichever
--    session is live. club_entry() tells the public page only the status, the
--    live session's join code and the club name.
-- 2. my_last_profile(): a returning player's name and level, from their own
--    most recent row in the same club.
-- 3. undo_last(): "Ibalik" for the most recent finish_game, remove_player or
--    confirm_payment, within 30 seconds and only if nothing else changed in
--    the session since. Those actions record a restore snapshot in events.
--
-- "Nothing else changed" is checked two ways: the action's event must be the
-- session's latest event, and a per-session change counter (bumped by a
-- trigger on every write to session_players, courts, games and payments, from
-- any code path) must still be the value recorded with that event.

-- ---------------------------------------------------------------------------
-- 1. Permanent club QR
-- ---------------------------------------------------------------------------

-- A join-code-style code no club uses yet (the unique index still guards races).
create function private.new_entry_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_code text;
begin
  loop
    v_code := private.generate_join_code();
    exit when not exists (select 1 from public.clubs c where c.entry_code = v_code);
  end loop;
  return v_code;
end;
$$;

alter table public.clubs add column entry_code text;

-- Backfill one club at a time so each sees the codes already given out.
do $$
declare
  v_id uuid;
begin
  for v_id in select id from public.clubs where entry_code is null order by created_at, id loop
    update public.clubs set entry_code = private.new_entry_code() where id = v_id;
  end loop;
end;
$$;

alter table public.clubs
  alter column entry_code set default private.new_entry_code(),
  alter column entry_code set not null,
  add constraint clubs_entry_code_key unique (entry_code),
  add constraint clubs_entry_code_format check (entry_code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$');

-- Staff already read clubs through the table-level select grant (RLS: their
-- own clubs). The update grant is per column and does not include entry_code:
-- only regenerate_entry_code() changes it.

-- Public: what /c/<code> needs, and nothing more.
create function public.club_entry(p_code text)
returns table (status text, join_code text, club_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_club public.clubs%rowtype;
  v_join_code text;
begin
  select * into v_club from public.clubs c where c.entry_code = upper(btrim(p_code));
  if not found then
    return query select 'not_found'::text, null::text, null::text;
    return;
  end if;

  select s.join_code into v_join_code
  from public.sessions s
  where s.club_id = v_club.id and s.status = 'live';

  if v_join_code is null then
    return query select 'none'::text, null::text, v_club.name;
  else
    return query select 'live'::text, v_join_code, v_club.name;
  end if;
end;
$$;

-- "Palitan ang QR" (owner only): printed copies of the old code stop working.
create function public.regenerate_entry_code(p_club_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  perform private.assert_organizer_account();
  if p_club_id is null or not public.is_club_owner(p_club_id) then
    raise exception 'not_owner' using errcode = '42501';
  end if;

  update public.clubs set entry_code = private.new_entry_code()
  where id = p_club_id
  returning entry_code into v_code;
  return v_code;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Remember the player
-- ---------------------------------------------------------------------------

-- The caller's name and level from their own most recent row in any session
-- of the join code's club. No rows when signed out, unknown code, or none.
create function public.my_last_profile(p_join_code text)
returns table (display_name text, level text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.display_name, p.level
  from public.sessions target
  join public.sessions s on s.club_id = target.club_id
  join public.session_players p on p.session_id = s.id
  where target.join_code = upper(btrim(p_join_code))
    and (select auth.uid()) is not null
    and p.user_id = (select auth.uid())
  order by p.created_at desc, p.queue_pos desc
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 3. Undo: change counter
-- ---------------------------------------------------------------------------

-- No foreign key: rows are written during cascading deletes of a session too.
create table private.session_changes (
  session_id uuid primary key,
  counter    bigint not null
);

create function private.count_session_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_id uuid;
begin
  if tg_op = 'DELETE' then
    v_session_id := old.session_id;
  else
    v_session_id := new.session_id;
  end if;

  insert into private.session_changes as c (session_id, counter) values (v_session_id, 1)
  on conflict (session_id) do update set counter = c.counter + 1;
  return null;
end;
$$;

create trigger session_players_count_change
  after insert or update or delete on public.session_players
  for each row execute function private.count_session_change();
create trigger courts_count_change
  after insert or update or delete on public.courts
  for each row execute function private.count_session_change();
create trigger games_count_change
  after insert or update or delete on public.games
  for each row execute function private.count_session_change();
create trigger payments_count_change
  after insert or update or delete on public.payments
  for each row execute function private.count_session_change();

create function private.session_change(p_session_id uuid)
returns bigint
language sql
stable
set search_path = ''
as $$
  select coalesce((select c.counter from private.session_changes c where c.session_id = p_session_id), 0);
$$;

-- Records an undoable action. Call it after the action's last write.
create function private.log_undoable(p_session_id uuid, p_type text, p_payload jsonb, p_undo jsonb)
returns void
language sql
set search_path = ''
as $$
  insert into public.events (session_id, actor, type, payload)
  values (p_session_id, auth.uid(), p_type,
          p_payload || jsonb_build_object('undo', p_undo, 'change', private.session_change(p_session_id)));
$$;

-- ---------------------------------------------------------------------------
-- finish_game: same rotation as Phase 4b (moved to a private function), plus
-- a snapshot of what it changes: the court, and every non-left player.
-- ---------------------------------------------------------------------------

create function private.finish_game_rotate(p_court_id uuid, p_game_id uuid, p_winner_ids uuid[])
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_court public.courts%rowtype;
  v_rotation text;
  v_game public.games%rowtype;
  v_needed integer;
  v_winners uuid[];
  v_losers uuid[];
  v_streak integer;
begin
  v_court := private.lock_live_court(p_court_id);
  select s.rotation into v_rotation from public.sessions s where s.id = v_court.session_id;

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

  if v_rotation = 'all_off' then
    perform private.requeue(v_game.player_ids);
    update public.courts set winner_streak = 0 where id = p_court_id;
    return private.try_call(p_court_id, v_court.session_id);
  end if;

  v_winners := array(
    select p from unnest(v_game.player_ids) with ordinality u(p, i) where p = any (p_winner_ids) order by i
  );
  v_losers := array(
    select p from unnest(v_game.player_ids) with ordinality u(p, i) where p <> all (p_winner_ids) order by i
  );
  v_streak := case
    when v_court.winner_streak > 0 and v_winners @> v_game.player_ids[1:v_needed] then v_court.winner_streak + 1
    else 1
  end;

  if v_streak >= 2 or cardinality(private.next_eligible(v_court.session_id, v_needed)) < v_needed then
    perform private.requeue(v_winners || v_losers);
    update public.courts set winner_streak = 0 where id = p_court_id;
    return private.try_call(p_court_id, v_court.session_id);
  end if;

  perform private.requeue(v_losers);
  update public.courts set winner_streak = v_streak where id = p_court_id;
  return private.start_game(
    p_court_id, v_court.session_id, v_winners || private.next_eligible(v_court.session_id, v_needed)
  );
end;
$$;

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
           'games_played', p.games_played, 'not_ready_at', p.not_ready_at)), '[]'::jsonb)
  into v_players
  from public.session_players p
  where p.session_id = v_court.session_id and p.status <> 'left';

  v_next := private.finish_game_rotate(p_court_id, p_game_id, p_winner_ids);

  perform private.log_undoable(
    v_court.session_id,
    'game_finished',
    jsonb_build_object('court_id', p_court_id, 'game_id', p_game_id, 'next_game_id', v_next, 'winner_ids', to_jsonb(p_winner_ids)),
    jsonb_build_object(
      'court', jsonb_build_object('current_game_id', v_court.current_game_id, 'winner_streak', v_court.winner_streak),
      'players', v_players
    )
  );
  return v_next;
end;
$$;

-- BR18 (unchanged rule), now recorded for undo.
create or replace function public.remove_player(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.session_players%rowtype;
begin
  perform private.assert_organizer_account();
  v_player := private.lock_live_player(p_player_id);
  if v_player.status not in ('queued', 'paused') then
    raise exception 'invalid_player_status' using errcode = 'P0001';
  end if;
  update public.session_players set status = 'left' where id = p_player_id;

  perform private.log_undoable(
    v_player.session_id,
    'player_removed',
    jsonb_build_object('player_id', p_player_id),
    jsonb_build_object('status', v_player.status, 'not_ready_at', v_player.not_ready_at)
  );
end;
$$;

-- "Natanggap na" (unchanged rule). set_payment writes the payment_confirmed
-- event (BR16); the restore snapshot is added to that same event.
create or replace function public.confirm_payment(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.session_players%rowtype;
  v_fee integer;
  v_old public.payments%rowtype;
begin
  perform private.assert_organizer_account();
  v_player := private.lock_staff_player(p_player_id);
  select s.fee into v_fee from public.sessions s where s.id = v_player.session_id;
  if v_fee = 0 then
    raise exception 'no_payment_needed' using errcode = 'P0001';
  end if;
  if v_player.payment_status = 'confirmed' then
    raise exception 'already_paid' using errcode = 'P0001';
  end if;

  select * into v_old from public.payments p where p.session_player_id = p_player_id;

  if v_player.payment_status = 'pending' then
    perform private.set_payment(p_player_id, 'confirmed', 'gcash', v_old.reference_digits, 'payment_confirmed');
  else
    perform private.set_payment(p_player_id, 'confirmed', 'cash', null, 'payment_confirmed');
  end if;

  update public.events e
  set payload = e.payload || jsonb_build_object(
    'undo', jsonb_build_object(
      'payment_status', v_player.payment_status,
      'method', v_old.method,
      'reference_digits', v_old.reference_digits,
      'amount', coalesce(v_old.amount, v_fee)
    ),
    'change', private.session_change(v_player.session_id)
  )
  where e.id = (
    select l.id from public.events l
    where l.session_id = v_player.session_id
    order by l.created_at desc, l.id desc
    limit 1
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- undo_last: organizer only. Restores the state from before the session's
-- latest action when that action is undoable, at most 30 seconds old, and
-- nothing else changed since. Returns the undone action's type.
-- ---------------------------------------------------------------------------

create function public.undo_last(p_session_id uuid)
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
        winner_streak = (v_undo -> 'court' ->> 'winner_streak')::integer
    where id = v_court_id;
    update public.session_players p
    set status = x.status, queue_pos = x.queue_pos, games_played = x.games_played, not_ready_at = x.not_ready_at
    from jsonb_to_recordset(v_undo -> 'players')
         as x(id uuid, status text, queue_pos bigint, games_played integer, not_ready_at timestamptz)
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

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------

revoke all on private.session_changes from public, anon, authenticated;

revoke execute on function
  private.new_entry_code(),
  private.count_session_change(),
  private.session_change(uuid),
  private.log_undoable(uuid, text, jsonb, jsonb),
  private.finish_game_rotate(uuid, uuid, uuid[]),
  public.club_entry(text),
  public.regenerate_entry_code(uuid),
  public.my_last_profile(text),
  public.undo_last(uuid)
from public, anon, authenticated;

-- The /c/<code> page asks before anyone signs in.
grant execute on function public.club_entry(text) to anon, authenticated;

grant execute on function
  public.regenerate_entry_code(uuid),
  public.my_last_profile(text),
  public.undo_last(uuid)
to authenticated;
