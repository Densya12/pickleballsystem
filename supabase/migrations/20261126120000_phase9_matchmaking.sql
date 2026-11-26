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
