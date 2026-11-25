-- Pre-pilot QA fixes (docs/qa/2026-11-qa-audit.md, QA-02 to QA-12).
--
-- Backward compatible with the app on main: every function keeps its name,
-- signature, grants, SECURITY DEFINER and search_path = ''. CREATE OR REPLACE
-- keeps existing grants. New error codes fall back to the app's generic
-- message on old clients. Sections are in finding order.

-- ===========================================================================
-- QA-02: "player is on court" (player_playing) is no longer the same error as
-- "already in that state" (invalid_player_status). The offline outbox counts
-- invalid_player_status as done; a refused Remove/Pause/Resume of a player who
-- was called meanwhile must not be.
-- ===========================================================================

create or replace function public.pause_player(p_player_id uuid)
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
  if v_player.status = 'playing' then
    raise exception 'player_playing' using errcode = 'P0001';
  end if;
  if v_player.status <> 'queued' then
    raise exception 'invalid_player_status' using errcode = 'P0001';
  end if;
  update public.session_players set status = 'paused' where id = p_player_id;
end;
$$;

create or replace function public.resume_player(p_player_id uuid)
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
  if v_player.status = 'playing' then
    raise exception 'player_playing' using errcode = 'P0001';
  end if;
  if v_player.status <> 'paused' then
    raise exception 'invalid_player_status' using errcode = 'P0001';
  end if;
  update public.session_players set status = 'queued' where id = p_player_id;
end;
$$;

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
  if v_player.status = 'playing' then
    raise exception 'player_playing' using errcode = 'P0001';
  end if;
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

-- ===========================================================================
-- QA-03 / D23: Winners stay with fewer than 2 players waiting. Everyone goes
-- off with the LOSERS FIRST, then the winners, so a winner sits out (5 players
-- doubles: the waiting player, both losers and one winner play next; 3 players
-- singles: the waiting player and the loser). Before D23 the winners were put
-- first and were called straight back every game. With 2 or more waiting
-- nothing changes: winners stay for at most 2 wins in a row, then all four go
-- off (winners first).
-- ===========================================================================

create or replace function private.finish_game_rotate(p_court_id uuid, p_game_id uuid, p_winner_ids uuid[])
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

  -- D23: fewer than 2 waiting: everyone goes off, losers first, so a winner sits out.
  if cardinality(private.next_eligible(v_court.session_id, 2)) < 2 then
    perform private.requeue(v_losers || v_winners);
    update public.courts set winner_streak = 0 where id = p_court_id;
    return private.try_call(p_court_id, v_court.session_id);
  end if;

  v_streak := case
    when v_court.winner_streak > 0 and v_winners @> v_game.player_ids[1:v_needed] then v_court.winner_streak + 1
    else 1
  end;

  -- BR11: second win in a row: all four go off (winners first) and the next group is called.
  if v_streak >= 2 then
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

-- ===========================================================================
-- QA-05: one phone can't flood a queue.
-- (a) A check-in can't use the name of someone already in line (compared
--     without case or spaces). Walk-ins added by the organizer may (the app
--     warns and lets them override), so add_walk_in is unchanged here.
-- (b) At most 200 active (waiting or playing) players per session, for every
--     way in: check-in, walk-in, and a left player coming back (Undo).
-- ===========================================================================

-- How names are compared: lower case, no spaces ("  Mark  SANTOS" = "marksantos").
create or replace function private.player_name_key(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(coalesce(p_name, ''), '\s+', '', 'g'));
$$;

create or replace function public.join_session(
  p_join_code text,
  p_display_name text,
  p_level text default 'unsure',
  p_method text default null,
  p_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.assert_signed_in();
  v_session_id uuid;
  v_status text;
  v_fee integer;
  v_player_id uuid;
begin
  select s.id into v_session_id from public.sessions s where s.join_code = upper(btrim(p_join_code));
  if not found then
    raise exception 'session_not_found' using errcode = 'P0001';
  end if;

  select s.status, s.fee into v_status, v_fee from public.sessions s where s.id = v_session_id for update;
  if v_status <> 'live' then
    raise exception 'checkin_closed' using errcode = 'P0001';
  end if;

  select p.id into v_player_id
  from public.session_players p
  where p.session_id = v_session_id and p.user_id = v_uid and p.status <> 'left';
  if found then
    return v_player_id;
  end if;

  if p_method is not null and p_method not in ('gcash', 'cash') then
    raise exception 'invalid_payment_method' using errcode = 'P0001';
  end if;

  -- QA-05 (a): the session row is locked above, so two phones can't both take a name.
  if exists (
    select 1 from public.session_players p
    where p.session_id = v_session_id and p.status <> 'left'
      and private.player_name_key(p.display_name) = private.player_name_key(p_display_name)
  ) then
    raise exception 'name_taken' using errcode = 'P0001';
  end if;

  insert into public.session_players (session_id, display_name, level, user_id, is_walk_in)
  values (v_session_id, p_display_name, coalesce(p_level, 'unsure'), v_uid, false)
  returning id into v_player_id;

  if v_fee > 0 and p_method is not null then
    perform private.apply_payment_choice(v_player_id, p_method, p_reference);
  end if;
  return v_player_id;
end;
$$;

-- QA-05 (b): every insert path locks the session row first, so the count can't race.
create or replace function private.cap_active_players()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status <> 'left' and (tg_op = 'INSERT' or old.status = 'left') then
    if (select count(*) from public.session_players p
        where p.session_id = new.session_id and p.status <> 'left' and p.id <> new.id) >= 200 then
      raise exception 'session_full' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists session_players_cap_active on public.session_players;
create trigger session_players_cap_active
  before insert or update of status on public.session_players
  for each row execute function private.cap_active_players();

revoke execute on function private.player_name_key(text), private.cap_active_players() from public, anon, authenticated;

-- ===========================================================================
-- QA-06: the code preview is public (anyone with the code), so it no longer
-- returns payment details (fee, pay first, GCash name and number). Players
-- see them after check-in (their own session row). Same columns, now null.
--
-- Codes: 31 unambiguous characters (no 0/O, 1/I/L). 6 characters = 31^6 =
-- 887,503,681 codes; 8 = 31^8 = 852,891,037,441 (about 961 times more
-- guesses per hit). New codes can be 8 characters, but the app on main
-- accepts only 6, so the length is a setting that starts at 6. After the app
-- that accepts 6 or 8 is deployed, switch it with:
--   update private.code_settings set join_code_length = 8, entry_code_length = 8;
-- Existing 6-character codes keep working.
-- ===========================================================================

create or replace function public.checkin_preview(p_join_code text)
returns table (
  status text, name text, starts_at timestamptz, ends_at timestamptz, courts_count integer, waiting integer,
  fee integer, pay_first boolean, gcash_name text, gcash_number text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_session public.sessions%rowtype;
begin
  select * into v_session from public.sessions s where s.join_code = upper(btrim(p_join_code));
  if not found then
    return query select 'not_found'::text, null::text, null::timestamptz, null::timestamptz, null::integer, null::integer,
                        null::integer, null::boolean, null::text, null::text;
    return;
  end if;

  if v_session.status <> 'live' then
    return query select v_session.status, null::text, null::timestamptz, null::timestamptz, null::integer, null::integer,
                        null::integer, null::boolean, null::text, null::text;
    return;
  end if;

  -- Payment details (fee, pay first, GCash) only after check-in.
  return query
  select v_session.status, v_session.name, v_session.starts_at, v_session.ends_at, v_session.courts_count,
         (select count(*)::integer from public.session_players p
          where p.session_id = v_session.id and p.status in ('queued', 'paused')),
         null::integer, null::boolean, null::text, null::text;
end;
$$;

create table if not exists private.code_settings (
  id boolean primary key default true check (id),
  join_code_length integer not null default 6 check (join_code_length in (6, 8)),
  entry_code_length integer not null default 6 check (entry_code_length in (6, 8))
);
insert into private.code_settings (id) values (true) on conflict (id) do nothing;
revoke all on private.code_settings from public, anon, authenticated;

-- 6 or 8 characters, same alphabet.
alter table public.sessions drop constraint if exists sessions_join_code_format;
alter table public.sessions add constraint sessions_join_code_format
  check (join_code ~ '^([ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}|[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{8})$');
alter table public.clubs drop constraint if exists clubs_entry_code_format;
alter table public.clubs add constraint clubs_entry_code_format
  check (entry_code ~ '^([ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}|[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{8})$');

create or replace function private.generate_join_code()
returns text
language plpgsql
set search_path = ''
as $$
declare
  -- 23 letters + 8 digits = 31 characters.
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_length integer := coalesce((select s.join_code_length from private.code_settings s), 6);
  v_bytes bytea;
  v_byte integer;
  v_code text := '';
begin
  while char_length(v_code) < v_length loop
    v_bytes := extensions.gen_random_bytes(16);
    for i in 0..15 loop
      v_byte := get_byte(v_bytes, i);
      -- 248 = 31 * 8: dropping bytes >= 248 keeps every character equally likely.
      if v_byte < 248 then
        v_code := v_code || substr(v_alphabet, (v_byte % 31) + 1, 1);
        exit when char_length(v_code) = v_length;
      end if;
    end loop;
  end loop;
  return v_code;
end;
$$;

create or replace function private.new_entry_code()
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_length integer := coalesce((select s.entry_code_length from private.code_settings s), 6);
  v_code text;
begin
  loop
    -- Same generator; pad or trim to the entry code length.
    v_code := private.generate_join_code();
    while char_length(v_code) < v_length loop
      v_code := v_code || private.generate_join_code();
    end loop;
    v_code := left(v_code, v_length);
    exit when not exists (select 1 from public.clubs c where c.entry_code = v_code);
  end loop;
  return v_code;
end;
$$;

-- ===========================================================================
-- QA-07: display names (players and members) without invisible characters
-- (zero-width U+200B-U+200F, direction controls U+202A-U+202E and
-- U+2066-U+2069, byte-order mark U+FEFF), spaces joined and trimmed, and with
-- at least one visible letter or number. The same rule as src/lib/names.ts;
-- both are checked against supabase/tests/database/name_cases.inc. The
-- 2-40 length checks stay and apply to the cleaned name.
-- ===========================================================================

create or replace function private.clean_display_name(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(
    regexp_replace(coalesce(p_name, ''), '[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]', '', 'g'),
    '\s+', ' ', 'g'));
$$;

-- A letter or number in any script. [[:alnum:]] depends on the database's
-- locale, so also accept any non-ASCII character outside the punctuation,
-- symbol and emoji blocks (a letter of another script).
create or replace function private.display_name_ok(p_name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select char_length(coalesce(p_name, '')) between 2 and 40
     and (p_name ~ '[[:alnum:]]'
          or p_name ~ '[^\x01-\x7F\u0080-\u00BF\u2000-\u2BFF\u3000-\u303F\uFE00-\uFE0F\uFF00-\uFF0F\U0001F000-\U0001FAFF]');
$$;

-- SECURITY DEFINER so the trigger can use the private name rule when a signed-in
-- user writes the row directly (members); it only rewrites NEW.
create or replace function public.session_players_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.display_name := private.clean_display_name(new.display_name);
  -- Length errors come from the existing check constraint; this adds "a letter or number".
  if char_length(new.display_name) between 2 and 40 and not private.display_name_ok(new.display_name) then
    raise exception 'name_needs_letter' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- SECURITY DEFINER so the trigger can use the private name rule when a signed-in
-- user writes the row directly (members); it only rewrites NEW.
create or replace function public.members_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.display_name := private.clean_display_name(new.display_name);
  if char_length(new.display_name) between 2 and 40 and not private.display_name_ok(new.display_name) then
    raise exception 'name_needs_letter' using errcode = '23514';
  end if;
  new.notes := nullif(btrim(new.notes), '');
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

-- QA-05's duplicate check compares cleaned names.
create or replace function private.player_name_key(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(private.clean_display_name(p_name), '\s+', '', 'g'));
$$;

revoke execute on function private.clean_display_name(text), private.display_name_ok(text) from public, anon, authenticated;
-- Trigger functions aren't called directly by clients.
revoke execute on function public.session_players_before_write(), public.members_before_write() from public, anon, authenticated;

-- ===========================================================================
-- QA-09 (BR19): swap_not_ready only swaps a player who said "not ready".
-- The UI only offers Swap for flagged players, but the API swapped anyone on
-- court to the front of the queue. Same signature, grants and search_path;
-- a new code player_not_flagged (old clients show their generic message).
-- The order of checks is kept: not on court is still player_not_on_court
-- (the outbox counts a repeated swap as done).
-- ===========================================================================

create or replace function public.swap_not_ready(p_court_id uuid, p_player_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_court public.courts%rowtype;
  v_player_ids uuid[];
  v_next uuid[];
  v_front bigint;
begin
  perform private.assert_organizer_account();
  v_court := private.lock_live_court(p_court_id);

  select g.player_ids into v_player_ids from public.games g where g.id = v_court.current_game_id;
  if v_court.current_game_id is null or not (p_player_id = any (v_player_ids)) then
    raise exception 'player_not_on_court' using errcode = 'P0001';
  end if;

  -- BR19: the player flags "not ready" first (player_not_ready sets not_ready_at).
  perform 1 from public.session_players p
  where p.id = p_player_id and p.not_ready_at is not null
  for update;
  if not found then
    raise exception 'player_not_flagged' using errcode = 'P0001';
  end if;

  v_next := private.next_eligible(v_court.session_id, 1);
  if cardinality(v_next) < 1 then
    raise exception 'not_enough_players' using errcode = 'P0001', detail = '1';
  end if;

  -- Lowest place among everyone waiting (queued or paused), before the newcomer leaves the queue.
  select min(p.queue_pos) into v_front
  from public.session_players p
  where p.session_id = v_court.session_id and p.status in ('queued', 'paused');

  update public.games set player_ids = array_replace(player_ids, p_player_id, v_next[1])
  where id = v_court.current_game_id;
  update public.session_players set status = 'playing', not_ready_at = null where id = v_next[1];
  update public.session_players
  set status = 'queued', not_ready_at = null, queue_pos = v_front - 1
  where id = p_player_id;

  return v_next[1];
end;
$$;

-- ===========================================================================
-- QA-10 (D18): with a fee, a walk-in needs a payment choice; fees are capped
-- at ₱100,000 (FEE_MAX in src/lib/club/validation.ts), in the database too.
-- The app on main already sends a payment for every walk-in when the fee is
-- above 0 (parseWalkInPayment) and caps fees in its forms, so neither change
-- refuses anything the deployed app sends.
-- ===========================================================================

create or replace function public.add_walk_in(
  p_session_id   uuid,
  p_display_name text,
  p_level        text,
  p_payment      text default null,
  p_reference    text default null,
  p_client_id    uuid default null,
  p_member_id    uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.sessions%rowtype;
  v_player_id uuid;
begin
  perform private.assert_organizer_account();
  v_session := private.lock_live_session(p_session_id);

  -- A resend of a walk-in already added (the session row is locked, so this can't race).
  if p_client_id is not null then
    select p.id into v_player_id
    from public.session_players p
    where p.session_id = p_session_id and p.client_id = p_client_id;
    if found then
      return v_player_id;
    end if;
  end if;

  if p_payment is not null and p_payment not in ('cash_received', 'gcash', 'later') then
    raise exception 'invalid_payment_method' using errcode = 'P0001';
  end if;
  -- D18: no default payment when there is a fee ("Pay later" is a choice, not a default).
  if v_session.fee > 0 and p_payment is null then
    raise exception 'payment_required' using errcode = 'P0001';
  end if;
  if p_member_id is not null and not exists (
    select 1 from public.members m where m.id = p_member_id and m.club_id = v_session.club_id
  ) then
    raise exception 'member_not_found' using errcode = 'P0001';
  end if;

  insert into public.session_players (session_id, display_name, level, is_walk_in, client_id, member_id)
  values (p_session_id, p_display_name, p_level, true, p_client_id, p_member_id)
  returning id into v_player_id;

  if v_session.fee > 0 and p_payment is not null then
    perform private.apply_payment_choice(v_player_id, p_payment, p_reference);
  end if;
  return v_player_id;
end;
$$;

-- Fee cap. Checked first: if any existing row is above the cap (none were in
-- local or audit data), the constraint is added NOT VALID so the migration
-- still applies; new and updated rows are checked either way.
alter table public.sessions drop constraint if exists sessions_fee_max;
alter table public.clubs drop constraint if exists clubs_default_fee_max;
do $$
begin
  if exists (select 1 from public.sessions where fee > 100000) then
    raise notice 'QA-10: sessions with fee > 100000 exist; adding sessions_fee_max NOT VALID';
    alter table public.sessions add constraint sessions_fee_max check (fee <= 100000) not valid;
  else
    alter table public.sessions add constraint sessions_fee_max check (fee <= 100000);
  end if;
  if exists (select 1 from public.clubs where default_fee > 100000) then
    raise notice 'QA-10: clubs with default_fee > 100000 exist; adding clubs_default_fee_max NOT VALID';
    alter table public.clubs add constraint clubs_default_fee_max check (default_fee <= 100000) not valid;
  else
    alter table public.clubs add constraint clubs_default_fee_max check (default_fee <= 100000);
  end if;
end;
$$;

-- ===========================================================================
-- QA-12 (BR11): changing the rotation no longer resets winner_streak.
-- Winners stay (P1+P2 win, streak 1) -> All off -> Winners stay let P1+P2's
-- next win count as their first, so they played a 3rd game in a row.
--
-- Why keeping the streak is safe:
--  1. winner_streak is read in one place only: finish_game_rotate's Winners
--     stay path, and only counts when this game's winners are the first
--     players of the current game, i.e. the winners who stayed on
--     (start_game(v_winners || next)). A stale value can't attach to anyone
--     else: a different pair winning starts again at 1.
--  2. Every All off Done sets the court's streak to 0, so a streak only
--     survives a rotation change while the same game is still being played.
--     Switching to All off and finishing a game clears it as before.
--  3. The other resets are unchanged: end_session, set_court_format, a
--     court's 2nd win, D23 (fewer than 2 waiting).
-- Same signature, grants, SECURITY DEFINER and search_path = ''.
-- ===========================================================================

create or replace function public.set_session_rotation(p_session_id uuid, p_rotation text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.sessions%rowtype;
begin
  -- Signed in and not anonymous (players sign in anonymously).
  perform private.assert_organizer_account();
  -- Staff of the session's club, session live; locks the session row first.
  v_session := private.lock_live_session(p_session_id);

  if p_rotation is null or p_rotation not in ('all_off', 'winners_stay') then
    raise exception 'invalid_rotation' using errcode = 'P0001';
  end if;
  if v_session.rotation = p_rotation then
    return;
  end if;

  -- QA-12: winner_streak is kept (see above).
  update public.sessions set rotation = p_rotation where id = p_session_id;

  insert into public.events (session_id, actor, type, payload)
  values (p_session_id, auth.uid(), 'rotation_changed',
          jsonb_build_object('from', v_session.rotation, 'to', p_rotation));
end;
$$;
