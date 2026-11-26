-- Phase 9: Matchmaking (spec D25, amends D11): level 1-5, presets, group
-- selection, teams and winners, previews.
--
-- Backward compatible with the deployed app until merge: every existing
-- function keeps its name, signature, grants, SECURITY DEFINER and
-- search_path = ''. The old text level column stays and is kept in sync with
-- the new 1-5 skill column, so the deployed app (which sends and reads
-- beginner/intermediate/advanced/unsure) keeps working. Existing sessions and
-- club defaults become Fair line (today's selection, unchanged).

-- ===========================================================================
-- 1. LEVEL (1-5, or not set)
-- ===========================================================================

alter table public.session_players add column if not exists skill smallint;
alter table public.members add column if not exists skill smallint;
alter table public.session_players drop constraint if exists session_players_skill_range;
alter table public.session_players add constraint session_players_skill_range check (skill is null or skill between 1 and 5);
alter table public.members drop constraint if exists members_skill_range;
alter table public.members add constraint members_skill_range check (skill is null or skill between 1 and 5);

-- Text from any client -> 1-5 or null. Old values: beginner 2, intermediate 3,
-- advanced 4, unsure (or anything else) not set. New clients send '1'..'5'.
create or replace function private.skill_from_text(p_level text)
returns smallint
language sql
immutable
set search_path = ''
as $$
  select case
    when p_level is null then null
    when lower(btrim(p_level)) = 'beginner' then 2
    when lower(btrim(p_level)) = 'intermediate' then 3
    when lower(btrim(p_level)) = 'advanced' then 4
    when btrim(p_level) ~ '^[1-5]$' then btrim(p_level)::smallint
    else null
  end::smallint;
$$;

-- 1-5 -> the old text column (for the deployed app): 1-2 beginner, 3
-- intermediate, 4-5 advanced, not set unsure.
create or replace function private.level_text_from_skill(p_skill smallint)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_skill is null then 'unsure'
    when p_skill <= 2 then 'beginner'
    when p_skill = 3 then 'intermediate'
    else 'advanced'
  end;
$$;

-- Keep level (text) and skill (1-5) in step: whichever the writer changed wins.
-- Text that isn't a known level is passed through unchanged, so the existing
-- check constraint still refuses it (as before).
create or replace function private.sync_level(p_op text, p_old_level text, p_old_skill smallint, p_new_level text, p_new_skill smallint)
returns table (level text, skill smallint)
language sql
immutable
set search_path = ''
as $$
  select case when from_text and not known then p_new_level else private.level_text_from_skill(s) end,
         case when from_text and not known then null else s end
  from (
    select
      (p_op = 'INSERT' and p_new_skill is null)
        or (p_op = 'UPDATE' and p_new_skill is not distinct from p_old_skill and p_new_level is distinct from p_old_level) as from_text,
      lower(btrim(coalesce(p_new_level, ''))) in ('beginner', 'intermediate', 'advanced', 'unsure')
        or btrim(coalesce(p_new_level, '')) ~ '^[1-5]$' as known,
      case
        when p_op = 'INSERT' and p_new_skill is not null then p_new_skill
        when p_op = 'INSERT' then private.skill_from_text(p_new_level)
        when p_new_skill is distinct from p_old_skill then p_new_skill
        when p_new_level is distinct from p_old_level then private.skill_from_text(p_new_level)
        else p_new_skill
      end as s
  ) x;
$$;

update public.session_players set skill = private.skill_from_text(level) where skill is null and level <> 'unsure';
update public.members set skill = private.skill_from_text(level) where skill is null and level <> 'unsure';

-- QA-07's name rule, plus the level sync.
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
  select l.level, l.skill into new.level, new.skill
  from private.sync_level(tg_op,
         case when tg_op = 'UPDATE' then old.level end, case when tg_op = 'UPDATE' then old.skill end,
         new.level, new.skill) l;
  return new;
end;
$$;

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
  select l.level, l.skill into new.level, new.skill
  from private.sync_level(tg_op,
         case when tg_op = 'UPDATE' then old.level end, case when tg_op = 'UPDATE' then old.skill end,
         new.level, new.skill) l;
  new.notes := nullif(btrim(new.notes), '');
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

-- The organizer changes a player's level mid-session (tap the name, then
-- Level). Remembered on the member record when the player is a member.
create or replace function public.set_player_level(p_player_id uuid, p_skill integer)
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
  if p_skill is not null and p_skill not between 1 and 5 then
    raise exception 'invalid_level' using errcode = 'P0001';
  end if;
  if v_player.status = 'left' then
    raise exception 'invalid_player_status' using errcode = 'P0001';
  end if;
  if v_player.skill is not distinct from p_skill::smallint then
    return;
  end if;
  update public.session_players set skill = p_skill::smallint where id = p_player_id;
  if v_player.member_id is not null then
    update public.members set skill = p_skill::smallint where id = v_player.member_id;
  end if;
  insert into public.events (session_id, actor, type, payload)
  values (v_player.session_id, auth.uid(), 'level_changed',
          jsonb_build_object('player_id', p_player_id, 'from', v_player.skill, 'to', p_skill));
end;
$$;

-- A returning player's name and level (1-5) for the check-in form. The
-- deployed app keeps using my_last_profile (text level); this adds the number.
create or replace function public.my_last_profile_v2(p_join_code text)
returns table (display_name text, level text, skill smallint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.display_name, p.level, p.skill
  from public.sessions target
  join public.sessions s on s.club_id = target.club_id
  join public.session_players p on p.session_id = s.id
  where target.join_code = upper(btrim(p_join_code))
    and (select auth.uid()) is not null
    and p.user_id = (select auth.uid())
  order by p.created_at desc, p.queue_pos desc
  limit 1;
$$;

-- Saving a player as a member keeps their level.
create or replace function public.save_player_as_member(
  p_player_id  uuid,
  p_member_id  uuid default null,
  p_create_new boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.session_players%rowtype;
  v_club_id uuid;
  v_member_id uuid;
begin
  perform private.assert_organizer_account();
  v_player := private.lock_staff_player(p_player_id);
  select s.club_id into v_club_id from public.sessions s where s.id = v_player.session_id;

  if p_member_id is not null then
    select m.id into v_member_id from public.members m where m.id = p_member_id and m.club_id = v_club_id;
    if not found then
      raise exception 'member_not_found' using errcode = 'P0001';
    end if;
  else
    if not coalesce(p_create_new, false) then
      select m.id into v_member_id
      from public.members m
      where m.club_id = v_club_id and lower(m.display_name) = lower(v_player.display_name)
      order by m.created_at, m.id
      limit 1;
      if found then
        raise exception 'member_exists' using errcode = 'P0001', detail = v_member_id::text;
      end if;
    end if;
    insert into public.members (club_id, display_name, level, skill)
    values (v_club_id, v_player.display_name, v_player.level, v_player.skill)
    returning id into v_member_id;
  end if;

  update public.session_players set member_id = v_member_id where id = p_player_id;
  return v_member_id;
end;
$$;

grant select (skill) on public.session_players to authenticated;
grant select (skill), insert (skill), update (skill) on public.members to authenticated;

revoke execute on function
  private.skill_from_text(text),
  private.level_text_from_skill(smallint),
  private.sync_level(text, text, smallint, text, smallint)
from public, anon, authenticated;
revoke execute on function public.set_player_level(uuid, integer), public.my_last_profile_v2(text) from public, anon, authenticated;
grant execute on function public.set_player_level(uuid, integer), public.my_last_profile_v2(text) to authenticated;

-- ===========================================================================
-- 2. PRESETS: mixed | same_level | fair_line (session setting, club default)
-- Existing sessions and club defaults become fair_line (today's selection).
-- The column default stays fair_line, so a club created by the deployed app
-- keeps today's behavior; the new app sets "mixed" on new clubs.
-- ===========================================================================

alter table public.sessions add column if not exists matchmaking text not null default 'fair_line';
alter table public.clubs add column if not exists default_matchmaking text not null default 'fair_line';
alter table public.sessions drop constraint if exists sessions_matchmaking_allowed;
alter table public.sessions add constraint sessions_matchmaking_allowed check (matchmaking in ('mixed', 'same_level', 'fair_line'));
alter table public.clubs drop constraint if exists clubs_default_matchmaking_allowed;
alter table public.clubs add constraint clubs_default_matchmaking_allowed check (default_matchmaking in ('mixed', 'same_level', 'fair_line'));

grant select (matchmaking) on public.sessions to authenticated;
grant select (default_matchmaking), update (default_matchmaking) on public.clubs to authenticated;

-- Same signature; new sessions take the club's default matchmaking.
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
        pay_first, fee, gcash_name, gcash_number, created_by, matchmaking
      ) values (
        p_club_id, p_name, p_starts_at, p_ends_at, p_courts_count, p_court_formats,
        coalesce(p_points_to, v_club.default_points),
        coalesce(p_rotation, v_club.default_rotation),
        coalesce(p_pay_first, false),
        coalesce(p_fee, v_club.default_fee),
        v_club.gcash_name, v_club.gcash_number, v_uid,
        v_club.default_matchmaking
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

-- The New session form (draft or live) and More (while live): the preset.
-- Organizer-only, logged, idempotent (safe to resend from the outbox), like
-- set_session_rotation. Takes effect at the next call.
create or replace function public.set_session_matchmaking(p_session_id uuid, p_matchmaking text)
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
  if p_matchmaking is null or p_matchmaking not in ('mixed', 'same_level', 'fair_line') then
    raise exception 'invalid_matchmaking' using errcode = 'P0001';
  end if;
  if v_session.matchmaking = p_matchmaking then
    return;
  end if;

  update public.sessions set matchmaking = p_matchmaking where id = p_session_id;
  insert into public.events (session_id, actor, type, payload)
  values (p_session_id, auth.uid(), 'matchmaking_changed',
          jsonb_build_object('from', v_session.matchmaking, 'to', p_matchmaking));
end;
$$;

revoke execute on function public.set_session_matchmaking(uuid, text) from public, anon, authenticated;
grant execute on function public.set_session_matchmaking(uuid, text) to authenticated;
