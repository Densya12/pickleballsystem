-- Brand-neutral payments: the club's payment method (GCash, Maya, Bank
-- transfer or Other with a name) and whether cash is accepted, copied to new
-- sessions like the other payment fields.
--
-- Backward compatible:
-- - The columns keep their names: gcash_name / gcash_number hold the account
--   name and number for any method; payments.method stays 'gcash' (paid to the
--   club's account, whatever the method) or 'cash'.
-- - Existing clubs and sessions become GCash with cash accepted (the column
--   defaults), so nothing changes for them or for the deployed app.
-- - The account number check now also allows bank and other account numbers
--   (4-30 digits) when the method isn't GCash or Maya; GCash and Maya keep the
--   mobile number rule (09 and 9 digits).
-- - create_session keeps its signature, grants, SECURITY DEFINER and
--   search_path = ''.

-- ===========================================================================
-- 1. COLUMNS
-- ===========================================================================

alter table public.clubs add column if not exists payment_method text not null default 'gcash';
alter table public.clubs add column if not exists payment_method_other text;
alter table public.clubs add column if not exists cash_accepted boolean not null default true;
alter table public.sessions add column if not exists payment_method text not null default 'gcash';
alter table public.sessions add column if not exists payment_method_other text;
alter table public.sessions add column if not exists cash_accepted boolean not null default true;

alter table public.clubs drop constraint if exists clubs_payment_method_allowed;
alter table public.clubs add constraint clubs_payment_method_allowed check (payment_method in ('gcash', 'maya', 'bank', 'other'));
alter table public.sessions drop constraint if exists sessions_payment_method_allowed;
alter table public.sessions add constraint sessions_payment_method_allowed check (payment_method in ('gcash', 'maya', 'bank', 'other'));

-- "Other" needs its name (2-30 characters); the other methods have none.
alter table public.clubs drop constraint if exists clubs_payment_method_other;
alter table public.clubs add constraint clubs_payment_method_other check (
  case when payment_method = 'other'
    then payment_method_other is not null and char_length(payment_method_other) between 2 and 30
    else payment_method_other is null end
);
alter table public.sessions drop constraint if exists sessions_payment_method_other;
alter table public.sessions add constraint sessions_payment_method_other check (
  case when payment_method = 'other'
    then payment_method_other is not null and char_length(payment_method_other) between 2 and 30
    else payment_method_other is null end
);

-- The account number: a mobile number for GCash and Maya, 4-30 digits otherwise.
alter table public.clubs drop constraint if exists clubs_gcash_number_format;
alter table public.clubs add constraint clubs_gcash_number_format check (
  gcash_number is null
  or (payment_method in ('gcash', 'maya') and gcash_number ~ '^09[0-9]{9}$')
  or (payment_method in ('bank', 'other') and gcash_number ~ '^[0-9]{4,30}$')
);
alter table public.sessions drop constraint if exists sessions_gcash_number_format;
alter table public.sessions add constraint sessions_gcash_number_format check (
  gcash_number is null
  or (payment_method in ('gcash', 'maya') and gcash_number ~ '^09[0-9]{9}$')
  or (payment_method in ('bank', 'other') and gcash_number ~ '^[0-9]{4,30}$')
);

grant select (payment_method, payment_method_other, cash_accepted),
      update (payment_method, payment_method_other, cash_accepted)
  on public.clubs to authenticated;
grant select (payment_method, payment_method_other, cash_accepted) on public.sessions to authenticated;

-- Same trigger, now also trimming the Other name (and dropping it for the other methods).
create or replace function public.clubs_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := btrim(new.name);
  new.city := nullif(btrim(new.city), '');
  new.gcash_name := nullif(btrim(new.gcash_name), '');
  -- Users may type "0917-123 4567"; store "09171234567".
  new.gcash_number := nullif(regexp_replace(new.gcash_number, '[[:space:]-]', '', 'g'), '');
  new.payment_method_other := case when new.payment_method = 'other' then nullif(btrim(new.payment_method_other), '') end;

  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;

  return new;
end;
$$;

revoke execute on function public.clubs_before_write() from public, anon, authenticated;

-- ===========================================================================
-- 2. NEW SESSIONS COPY THE CLUB'S PAYMENT METHOD (same signature)
-- ===========================================================================

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
        pay_first, fee, gcash_name, gcash_number, created_by, matchmaking, call_mode,
        payment_method, payment_method_other, cash_accepted
      ) values (
        p_club_id, p_name, p_starts_at, p_ends_at, p_courts_count, p_court_formats,
        coalesce(p_points_to, v_club.default_points),
        coalesce(p_rotation, v_club.default_rotation),
        coalesce(p_pay_first, false),
        coalesce(p_fee, v_club.default_fee),
        v_club.gcash_name, v_club.gcash_number, v_uid,
        v_club.default_matchmaking,
        v_club.default_call_mode,
        v_club.payment_method, v_club.payment_method_other, v_club.cash_accepted
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
