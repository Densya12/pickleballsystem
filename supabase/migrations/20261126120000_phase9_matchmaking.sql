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

-- ===========================================================================
-- 3. GROUP SELECTION: one private function for every call
-- (try_call, call_next, finish_game_rotate, swap_not_ready, the previews).
--
-- Fair line: today's selection exactly (the next N eligible in queue order).
-- Mixed / Same level:
--  a) the anchor (longest-waiting eligible player) is always in the group;
--  b) candidates: the next 8 eligible in queue order (6 for singles);
--  c) valid groups contain the anchor and fit the level rule together with
--     any fixed players (winners who stay): Mixed max-min <= 1, Same level
--     equal, among players with a level ("not set" fits any band);
--  d) score = 10 x (pairs who shared a game within either player's last 2
--     games, counting only pairs with a newcomer) + the sum of the queue
--     ranks; lowest wins, ties broken by queue order;
--  e) skip protection: a candidate passed over for someone behind them gets
--     skip_count + 1; a group may not pass over anyone with skip_count >= 2
--     (so nobody is skipped a 3rd time); called players reset to 0;
--  f) no valid group: no call ("No level N-M group yet"; "Call mixed").
-- Deterministic: the same state gives the same group.
-- ===========================================================================

alter table public.session_players add column if not exists skip_count integer not null default 0;
alter table public.games add column if not exists stayed_ids uuid[];
alter table public.games add column if not exists call_note jsonb;
alter table public.session_players drop constraint if exists session_players_skip_count_min;
alter table public.session_players add constraint session_players_skip_count_min check (skip_count >= 0);
grant select (stayed_ids, call_note) on public.games to authenticated;
grant select (skip_count) on public.session_players to authenticated;

-- Per player id: the players who shared a game with them in their last 2 finished games.
create or replace function private.recent_mates(p_session_id uuid, p_ids uuid[])
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(x.id::text, x.mates), '{}'::jsonb)
  from (
    select pid as id,
           coalesce((
             select jsonb_agg(distinct m::text)
             from (
               select g.player_ids
               from public.games g
               where g.session_id = p_session_id and g.ended_at is not null and pid = any (g.player_ids)
               order by g.ended_at desc, g.number desc
               limit 2
             ) last2
             cross join lateral unnest(last2.player_ids) m
             where m <> pid
           ), '[]'::jsonb) as mates
    from unnest(p_ids) pid
  ) x;
$$;

/** uuid[] from a jsonb array of strings, in order. */
create or replace function private.uuids_of(p jsonb)
returns uuid[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(e.value::uuid order by e.ord), '{}')
  from jsonb_array_elements_text(coalesce(p, '[]'::jsonb)) with ordinality e(value, ord);
$$;

-- p_require_anchor = false (the one-player swap replacement): the earliest
-- waiting player who fits, rather than only the longest-waiting one.
create or replace function private.select_group(p_session_id uuid, p_format text, p_fixed uuid[] default '{}', p_require_anchor boolean default true)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_fixed uuid[] := coalesce(p_fixed, '{}');
  v_preset text;
  v_need integer;
  v_window integer := case when p_format = 'singles' then 6 else 8 end;
  v_ids uuid[];
  v_skill smallint[];
  v_skip integer[];
  v_fixed_skill smallint[];
  v_mates jsonb;
  v_best record;
  v_lo integer;
  v_hi integer;
begin
  select s.matchmaking into v_preset from public.sessions s where s.id = p_session_id;
  v_need := private.court_size(p_format) - cardinality(v_fixed);
  if v_need <= 0 then
    return jsonb_build_object('status', 'ok', 'preset', v_preset, 'group', '[]'::jsonb, 'skipped', '[]'::jsonb);
  end if;

  select coalesce(array_agg(e.player_id order by e.queue_pos), '{}'),
         coalesce(array_agg(p.skill order by e.queue_pos), '{}'),
         coalesce(array_agg(p.skip_count order by e.queue_pos), '{}')
  into v_ids, v_skill, v_skip
  from (
    select el.player_id, el.queue_pos
    from private.eligible_players(p_session_id) el
    where not (el.player_id = any (v_fixed))
    order by el.queue_pos
    limit case when v_preset = 'fair_line' then v_need else v_window end
  ) e
  join public.session_players p on p.id = e.player_id;

  if cardinality(v_ids) < v_need then
    return jsonb_build_object('status', 'not_enough', 'preset', v_preset, 'missing', v_need - cardinality(v_ids));
  end if;

  select coalesce(array_agg(p.skill), '{}') into v_fixed_skill
  from public.session_players p where p.id = any (v_fixed);

  if v_preset = 'fair_line' then
    -- Today's selection: the next N eligible, in queue order. No skips.
    return jsonb_build_object('status', 'ok', 'preset', v_preset, 'group', to_jsonb(v_ids[1:v_need]), 'skipped', '[]'::jsonb);
  end if;

  v_mates := private.recent_mates(p_session_id, v_ids || v_fixed);

  with recursive
    w(i, id, skill, skip) as (
      select i, v_ids[i], v_skill[i], v_skip[i] from generate_subscripts(v_ids, 1) i
    ),
    combos(idx) as (
      select array[w.i] from w where w.i = 1 or not p_require_anchor
      union all
      select c.idx || w.i
      from combos c join w on w.i > c.idx[cardinality(c.idx)]
      where cardinality(c.idx) < v_need
    ),
    scored as (
      select c.idx,
             (select array_agg(w.id order by w.i) from w where w.i = any (c.idx)) as ids,
             (select max(z.s) from (select w.skill as s from w where w.i = any (c.idx) union all select unnest(v_fixed_skill)) z) as hi,
             (select min(z.s) from (select w.skill as s from w where w.i = any (c.idx) union all select unnest(v_fixed_skill)) z) as lo,
             (select max(x) from unnest(c.idx) x) as last_i,
             (select sum(x) from unnest(c.idx) x)::integer as pos_sum
      from combos c
      where cardinality(c.idx) = v_need
    ),
    valid as (
      select sc.*,
             (select count(*)
              from unnest(sc.ids) a
              cross join unnest(sc.ids || v_fixed) b
              where a <> b
                and (not (b = any (sc.ids)) or a < b)
                and ((v_mates -> a::text) ? b::text or (v_mates -> b::text) ? a::text))::integer as repeats
      from scored sc
      where (sc.hi is null or (case when v_preset = 'mixed' then sc.hi - sc.lo <= 1 else sc.hi = sc.lo end))
        and not exists (select 1 from w where not (w.i = any (sc.idx)) and w.i < sc.last_i and w.skip >= 2)
    )
  select v.idx, v.ids, v.lo, v.hi, v.repeats, v.last_i into v_best
  from valid v
  order by v.repeats * 10 + v.pos_sum, v.idx
  limit 1;

  if v_best.idx is null then
    -- No valid group: the band the anchor (and any fixed players) could play in.
    -- Mixed: a level-3 anchor alone can play with 2-4; with a fixed level 4, 3-4.
    -- Same level: the anchor's level. No band when nobody has a level.
    select case when v_preset = 'mixed' then greatest(1, max(z.s) - 1) else max(z.s) end,
           case when v_preset = 'mixed' then least(5, min(z.s) + 1) else max(z.s) end
    into v_lo, v_hi
    from (select v_skill[1] as s union all select unnest(v_fixed_skill)) z
    where z.s is not null;
    return jsonb_build_object('status', 'no_group', 'preset', v_preset, 'anchor', v_ids[1], 'lo', v_lo, 'hi', v_hi);
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'preset', v_preset,
    'group', to_jsonb(v_best.ids),
    'skipped', coalesce((select jsonb_agg(w.id order by w.i)
                         from unnest(v_ids) with ordinality w(id, i)
                         where w.i < v_best.last_i and not (w.i = any (v_best.idx))), '[]'::jsonb),
    'lo', v_best.lo,
    'hi', v_best.hi,
    'repeats', v_best.repeats
  );
end;
$$;

-- Starts a game: the players (winners who stayed first), the note that
-- explains the call, skip counts reset. Team ordering is added in part 4.
create or replace function private.launch_game(p_court_id uuid, p_session_id uuid, p_newcomers uuid[], p_stayed uuid[], p_note jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_number integer;
  v_game_id uuid;
  v_players uuid[] := coalesce(p_stayed, '{}') || coalesce(p_newcomers, '{}');
begin
  select coalesce(max(g.number), 0) + 1 into v_number from public.games g where g.session_id = p_session_id;

  insert into public.games (session_id, court_id, number, player_ids, format, stayed_ids, call_note)
  select p_session_id, p_court_id, v_number, v_players, c.format, coalesce(p_stayed, '{}'), p_note
  from public.courts c where c.id = p_court_id
  returning id into v_game_id;

  update public.session_players set status = 'playing', not_ready_at = null, skip_count = 0 where id = any (v_players);
  update public.courts set current_game_id = v_game_id where id = p_court_id;
  return v_game_id;
end;
$$;

-- The note on a game that explains its call (banners): preset, level range, repeats.
create or replace function private.call_note(p_result jsonb, p_extra jsonb default '{}')
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'preset', p_result ->> 'preset',
    'lo', p_result -> 'lo',
    'hi', p_result -> 'hi',
    'repeats', p_result -> 'repeats'
  )) || coalesce(p_extra, '{}');
$$;

create or replace function private.apply_skips(p_result jsonb)
returns void
language sql
set search_path = ''
as $$
  update public.session_players set skip_count = skip_count + 1
  where id = any (private.uuids_of(p_result -> 'skipped'));
$$;

create or replace function private.try_call(p_court_id uuid, p_session_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_format text := (select c.format from public.courts c where c.id = p_court_id);
  v_res jsonb := private.select_group(p_session_id, v_format, '{}');
begin
  if v_res ->> 'status' <> 'ok' then
    return null;
  end if;
  perform private.apply_skips(v_res);
  return private.launch_game(p_court_id, p_session_id, private.uuids_of(v_res -> 'group'), '{}', private.call_note(v_res));
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
  v_res jsonb;
begin
  perform private.assert_organizer_account();
  v_court := private.lock_live_court(p_court_id);

  if v_court.current_game_id is not null then
    raise exception 'court_busy' using errcode = 'P0001';
  end if;

  v_res := private.select_group(v_court.session_id, v_court.format, '{}');
  if v_res ->> 'status' = 'not_enough' then
    raise exception 'not_enough_players' using errcode = 'P0001', detail = v_res ->> 'missing';
  end if;
  if v_res ->> 'status' = 'no_group' then
    -- D25: no group fits the level rule; the organizer can "Call mixed".
    raise exception 'no_level_group' using errcode = 'P0001',
      detail = coalesce((v_res ->> 'lo') || '-' || (v_res ->> 'hi'), '');
  end if;

  update public.courts set winner_streak = 0 where id = p_court_id;
  perform private.apply_skips(v_res);
  return private.launch_game(p_court_id, v_court.session_id, private.uuids_of(v_res -> 'group'), '{}', private.call_note(v_res));
end;
$$;

-- D25 (f): "Call mixed": the anchor and the next eligible players in queue
-- order, once, ignoring level. Logged.
create or replace function public.call_mixed(p_court_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_court public.courts%rowtype;
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

  v_size := private.court_size(v_court.format);
  v_players := private.next_eligible(v_court.session_id, v_size);
  if cardinality(v_players) < v_size then
    raise exception 'not_enough_players' using errcode = 'P0001', detail = (v_size - cardinality(v_players))::text;
  end if;
  select min(p.skill), max(p.skill) into v_lo, v_hi from public.session_players p where p.id = any (v_players);

  insert into public.events (session_id, actor, type, payload)
  values (v_court.session_id, auth.uid(), 'mixed_call', jsonb_build_object('court_id', p_court_id, 'player_ids', to_jsonb(v_players)));

  update public.courts set winner_streak = 0 where id = p_court_id;
  return private.launch_game(
    p_court_id, v_court.session_id, v_players, '{}',
    jsonb_strip_nulls(jsonb_build_object('preset', (select s.matchmaking from public.sessions s where s.id = v_court.session_id),
                                         'lo', v_lo, 'hi', v_hi, 'mixed_call', true))
  );
end;
$$;

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
  v_res jsonb;
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
    return private.try_call(p_court_id, v_court.session_id);
  end if;

  perform private.requeue(v_losers);
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

-- (h) The not-ready swap uses the same selection for one player: the
-- earliest waiting player who fits the level rule with the three still on
-- court (skip protection applies). If nobody fits, the longest-waiting
-- eligible player comes in anyway: a swap is never blocked by level.
create or replace function public.swap_not_ready(p_court_id uuid, p_player_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_court public.courts%rowtype;
  v_player_ids uuid[];
  v_res jsonb;
  v_new uuid;
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

  v_res := private.select_group(v_court.session_id, v_court.format, array_remove(v_player_ids, p_player_id), false);
  if v_res ->> 'status' = 'ok' then
    v_new := (private.uuids_of(v_res -> 'group'))[1];
    perform private.apply_skips(v_res);
  else
    v_new := (private.next_eligible(v_court.session_id, 1))[1];
  end if;
  if v_new is null then
    raise exception 'not_enough_players' using errcode = 'P0001', detail = '1';
  end if;

  -- Lowest place among everyone waiting (queued or paused), before the newcomer leaves the queue.
  select min(p.queue_pos) into v_front
  from public.session_players p
  where p.session_id = v_court.session_id and p.status in ('queued', 'paused');

  update public.games set player_ids = array_replace(player_ids, p_player_id, v_new)
  where id = v_court.current_game_id;
  update public.session_players set status = 'playing', not_ready_at = null, skip_count = 0 where id = v_new;
  update public.session_players
  set status = 'queued', not_ready_at = null, queue_pos = v_front - 1
  where id = p_player_id;

  return v_new;
end;
$$;

-- Undo of a finished game also restores skip counts (snapshots from before
-- Phase 9 have none: those keep the current value).
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
      'court', jsonb_build_object('current_game_id', v_court.current_game_id, 'winner_streak', v_court.winner_streak),
      'players', v_players
    )
  );
  return v_next;
end;
$$;

create or replace function public.undo_last(p_session_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

revoke execute on function
  private.recent_mates(uuid, uuid[]),
  private.uuids_of(jsonb),
  private.select_group(uuid, text, uuid[], boolean),
  private.launch_game(uuid, uuid, uuid[], uuid[], jsonb),
  private.call_note(jsonb, jsonb),
  private.apply_skips(jsonb)
from public, anon, authenticated;
revoke execute on function public.call_mixed(uuid) from public, anon, authenticated;
grant execute on function public.call_mixed(uuid) to authenticated;
