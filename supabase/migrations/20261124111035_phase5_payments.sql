-- Phase 5: payments (records only; the app never moves money).
--
-- BR13 at check-in: GCash reference -> pending, cash -> unpaid until the
--      organizer taps "Natanggap na".
-- BR14 pending counts as paid for the queue.
-- BR15 references are stored as digits only (6-20); a duplicate in the same
--      session is flagged to the organizer, not rejected.
-- BR16 every payment change writes an event (who, when).
-- BR6  with pay_first, only pending/confirmed players are eligible.
-- NF14 no player can read another player's reference (tables, functions, Realtime).
-- A session with fee 0 has no payment step.
--
-- All payment changes go through private.set_payment, which keeps
-- payments.status and session_players.payment_status in step and writes the event.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

alter table public.session_players
  add column payment_status text not null default 'unpaid',
  add constraint session_players_payment_status_allowed check (payment_status in ('unpaid', 'pending', 'confirmed'));

-- Staff and players of the session read it (it drives "Bayad na" and holds).
grant select (payment_status) on public.session_players to authenticated;

create table public.payments (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references public.sessions (id) on delete cascade,
  session_player_id uuid not null unique references public.session_players (id) on delete cascade,
  -- null until the player (or organizer) picks GCash or cash
  method            text,
  reference_digits  text,
  -- the session fee when the row last changed
  amount            integer not null,
  status            text not null,
  updated_by        uuid references auth.users (id) on delete set null,
  updated_at        timestamptz not null default now(),
  created_at        timestamptz not null default now(),

  constraint payments_method_allowed check (method is null or method in ('gcash', 'cash')),
  constraint payments_status_allowed check (status in ('unpaid', 'pending', 'confirmed')),
  constraint payments_amount_min check (amount >= 0),
  constraint payments_reference_digits check (reference_digits is null or reference_digits ~ '^[0-9]{6,20}$'),
  constraint payments_reference_only_gcash check (reference_digits is null or method = 'gcash'),
  constraint payments_pending_has_reference check (status <> 'pending' or (method = 'gcash' and reference_digits is not null)),
  constraint payments_confirmed_has_method check (status <> 'confirmed' or method is not null)
);

create index payments_session_id_idx on public.payments (session_id);

create table public.events (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  actor      uuid references auth.users (id) on delete set null,
  type       text not null,
  payload    jsonb not null default '{}'::jsonb,
  -- clock_timestamp(): the real moment of each change, so events made in one
  -- transaction still sort in the order they happened.
  created_at timestamptz not null default clock_timestamp()
);

create index events_session_id_created_at_idx on public.events (session_id, created_at);

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------

revoke all on public.payments, public.events from anon, authenticated;

-- updated_by (a user id) stays server-side; who did what is in events for staff.
grant select (id, session_id, session_player_id, method, reference_digits, amount, status, updated_at, created_at)
  on public.payments to authenticated;
grant select on public.events to authenticated;

alter table public.payments enable row level security;
alter table public.events enable row level security;

-- True when the row is the caller's own session_players row.
create function public.is_own_player(p_session_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.session_players p
    where p.id = p_session_player_id and p.user_id = (select auth.uid())
  );
$$;

create policy "Staff can read their sessions' payments"
  on public.payments for select to authenticated
  using (public.is_session_staff(session_id));

-- NF14: a player sees only their own payment row (never anyone else's reference).
create policy "Players can read their own payment"
  on public.payments for select to authenticated
  using (public.is_own_player(session_player_id));

create policy "Staff can read their sessions' events"
  on public.events for select to authenticated
  using (public.is_session_staff(session_id));

-- ---------------------------------------------------------------------------
-- Eligibility (BR6): the ONE rule. pay_first (with a fee) needs pending or
-- confirmed payment (BR14). The client mirrors this in isCallable().
-- ---------------------------------------------------------------------------

create or replace function private.eligible_players(p_session_id uuid)
returns table (player_id uuid, queue_pos bigint)
language sql
stable
set search_path = ''
as $$
  select p.id, p.queue_pos
  from public.session_players p
  join public.sessions s on s.id = p.session_id
  where p.session_id = p_session_id
    and p.status = 'queued'
    and (not s.pay_first or s.fee = 0 or p.payment_status in ('pending', 'confirmed'));
$$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- BR15: "1234 5678-90" -> "1234567890". Spaces and dashes only; 6-20 digits.
create function private.normalize_reference(p_reference text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_digits text := regexp_replace(coalesce(p_reference, ''), '[[:space:]-]', '', 'g');
begin
  if v_digits !~ '^[0-9]{6,20}$' then
    raise exception 'invalid_reference' using errcode = 'P0001';
  end if;
  return v_digits;
end;
$$;

-- The only writer of payments. Keeps both statuses in step and records the
-- change (BR16) in the same transaction. Callers have already locked the session.
create function private.set_payment(
  p_player_id uuid,
  p_status    text,
  p_method    text,
  p_reference text,
  p_type      text
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_session_id uuid;
  v_fee integer;
  v_old public.payments%rowtype;
begin
  select p.session_id, s.fee into v_session_id, v_fee
  from public.session_players p join public.sessions s on s.id = p.session_id
  where p.id = p_player_id;

  select * into v_old from public.payments where session_player_id = p_player_id;

  insert into public.payments (session_id, session_player_id, method, reference_digits, amount, status, updated_by, updated_at)
  values (v_session_id, p_player_id, p_method, p_reference, v_fee, p_status, auth.uid(), now())
  on conflict (session_player_id) do update
  set method = excluded.method,
      reference_digits = excluded.reference_digits,
      amount = excluded.amount,
      status = excluded.status,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at;

  update public.session_players set payment_status = p_status where id = p_player_id;

  insert into public.events (session_id, actor, type, payload)
  values (v_session_id, auth.uid(), p_type, jsonb_build_object(
    'player_id', p_player_id,
    'from', coalesce(v_old.status, 'unpaid'),
    'to', p_status,
    'method', p_method,
    'reference_digits', p_reference,
    'previous_method', v_old.method,
    'previous_reference_digits', v_old.reference_digits,
    'amount', v_fee
  ));
end;
$$;

-- A player of a live or ended session the caller is staff of (payments can be
-- settled after the session ends). Locks the session, then the player.
create function private.lock_staff_player(p_player_id uuid)
returns public.session_players
language plpgsql
set search_path = ''
as $$
declare
  v_session_id uuid;
  v_club_id uuid;
  v_status text;
  v_player public.session_players%rowtype;
begin
  select p.session_id, s.club_id into v_session_id, v_club_id
  from public.session_players p join public.sessions s on s.id = p.session_id
  where p.id = p_player_id;
  if not found or not public.is_club_staff(v_club_id) then
    raise exception 'player_not_found' using errcode = 'P0001';
  end if;

  select s.status into v_status from public.sessions s where s.id = v_session_id for update;
  if v_status = 'draft' then
    raise exception 'session_not_live' using errcode = 'P0001';
  end if;

  select * into v_player from public.session_players p where p.id = p_player_id for update;
  return v_player;
end;
$$;

-- Applies a check-in or walk-in payment choice to a new row (fee > 0 only).
create function private.apply_payment_choice(p_player_id uuid, p_choice text, p_reference text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  case p_choice
    when 'gcash' then
      perform private.set_payment(p_player_id, 'pending', 'gcash', private.normalize_reference(p_reference), 'payment_reference_submitted');
    when 'cash' then
      perform private.set_payment(p_player_id, 'unpaid', 'cash', null, 'payment_cash_chosen');
    when 'cash_received' then
      perform private.set_payment(p_player_id, 'confirmed', 'cash', null, 'payment_confirmed');
    when 'later' then
      null;
    else
      raise exception 'invalid_payment_method' using errcode = 'P0001';
  end case;
end;
$$;

-- ---------------------------------------------------------------------------
-- checkin_preview: also fee, pay_first and the club's GCash (live sessions only).
-- ---------------------------------------------------------------------------

drop function public.checkin_preview(text);

create function public.checkin_preview(p_join_code text)
returns table (
  status text,
  name text,
  starts_at timestamptz,
  ends_at timestamptz,
  courts_count integer,
  waiting integer,
  fee integer,
  pay_first boolean,
  gcash_name text,
  gcash_number text
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

  return query
  select v_session.status, v_session.name, v_session.starts_at, v_session.ends_at, v_session.courts_count,
         (select count(*)::integer from public.session_players p
          where p.session_id = v_session.id and p.status in ('queued', 'paused')),
         v_session.fee, v_session.pay_first, v_session.gcash_name, v_session.gcash_number;
end;
$$;

-- ---------------------------------------------------------------------------
-- join_session: optional payment choice (BR13). p_method 'gcash' needs a
-- reference (-> pending); 'cash' -> unpaid. Ignored when the fee is 0.
-- ---------------------------------------------------------------------------

drop function public.join_session(text, text, text);

create function public.join_session(
  p_join_code    text,
  p_display_name text,
  p_level        text default 'unsure',
  p_method       text default null,
  p_reference    text default null
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

  insert into public.session_players (session_id, display_name, level, user_id, is_walk_in)
  values (v_session_id, p_display_name, coalesce(p_level, 'unsure'), v_uid, false)
  returning id into v_player_id;

  if v_fee > 0 and p_method is not null then
    perform private.apply_payment_choice(v_player_id, p_method, p_reference);
  end if;
  return v_player_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- add_walk_in: payment choice 'cash_received' (confirmed), 'gcash' with a
-- reference (pending) or 'later' / null (unpaid). Ignored when the fee is 0.
-- ---------------------------------------------------------------------------

drop function public.add_walk_in(uuid, text, text);

create function public.add_walk_in(
  p_session_id   uuid,
  p_display_name text,
  p_level        text,
  p_payment      text default null,
  p_reference    text default null
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

  if p_payment is not null and p_payment not in ('cash_received', 'gcash', 'later') then
    raise exception 'invalid_payment_method' using errcode = 'P0001';
  end if;

  insert into public.session_players (session_id, display_name, level, is_walk_in)
  values (p_session_id, p_display_name, p_level, true)
  returning id into v_player_id;

  if v_session.fee > 0 and p_payment is not null then
    perform private.apply_payment_choice(v_player_id, p_payment, p_reference);
  end if;
  return v_player_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Player: submit (or correct) a GCash reference. Own row only; not after confirmed.
-- ---------------------------------------------------------------------------

create function public.player_submit_reference(p_player_id uuid, p_reference text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.session_players%rowtype := private.lock_own_player(p_player_id);
  v_fee integer;
begin
  if v_player.status = 'left' then
    raise exception 'invalid_player_status' using errcode = 'P0001';
  end if;
  select s.fee into v_fee from public.sessions s where s.id = v_player.session_id;
  if v_fee = 0 then
    raise exception 'no_payment_needed' using errcode = 'P0001';
  end if;
  if v_player.payment_status = 'confirmed' then
    raise exception 'already_paid' using errcode = 'P0001';
  end if;

  perform private.set_payment(p_player_id, 'pending', 'gcash', private.normalize_reference(p_reference), 'payment_reference_submitted');
end;
$$;

-- ---------------------------------------------------------------------------
-- Organizer: "Natanggap na" (pending GCash -> confirmed; unpaid -> confirmed cash)
-- and undo (back to unpaid, clearing the method and reference).
-- ---------------------------------------------------------------------------

create function public.confirm_payment(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.session_players%rowtype;
  v_fee integer;
  v_reference text;
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

  if v_player.payment_status = 'pending' then
    select p.reference_digits into v_reference from public.payments p where p.session_player_id = p_player_id;
    perform private.set_payment(p_player_id, 'confirmed', 'gcash', v_reference, 'payment_confirmed');
  else
    perform private.set_payment(p_player_id, 'confirmed', 'cash', null, 'payment_confirmed');
  end if;
end;
$$;

create function public.undo_payment(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.session_players%rowtype;
begin
  perform private.assert_organizer_account();
  v_player := private.lock_staff_player(p_player_id);
  if v_player.payment_status = 'unpaid' then
    raise exception 'invalid_payment_status' using errcode = 'P0001';
  end if;
  perform private.set_payment(p_player_id, 'unpaid', null, null, 'payment_undone');
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------

revoke execute on function
  private.normalize_reference(text),
  private.set_payment(uuid, text, text, text, text),
  private.lock_staff_player(uuid),
  private.apply_payment_choice(uuid, text, text),
  public.is_own_player(uuid),
  public.checkin_preview(text),
  public.join_session(text, text, text, text, text),
  public.add_walk_in(uuid, text, text, text, text),
  public.player_submit_reference(uuid, text),
  public.confirm_payment(uuid),
  public.undo_payment(uuid)
from public, anon, authenticated;

grant execute on function public.checkin_preview(text) to anon, authenticated;

grant execute on function
  public.is_own_player(uuid),
  public.join_session(text, text, text, text, text),
  public.add_walk_in(uuid, text, text, text, text),
  public.player_submit_reference(uuid, text),
  public.confirm_payment(uuid),
  public.undo_payment(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: the Bayad screen and the player's own payment update live.
-- RLS decides who receives which rows (players: their own only).
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.payments;
