-- Phase 9.2b: Balanced teams (spec D29).
--
-- A new matchmaking preset 'balanced': levels may be far apart in one game as
-- long as the two teams are about even. A doubles group is valid when
--   a) the best pairing of the 4 has team totals within 1, and
--   b) the highest and lowest level in the game are at most 3 apart
--      (1 and 5 never share a court).
-- Players with no level count as the group's average (as order_teams does),
-- so they never make a group invalid on their own. With 2 staying winners the
-- 2 newcomers are a team. Singles: as Mixed (levels at most 1 apart).
-- Scoring among valid groups: repeats*10 + team difference*5 + sum of
-- positions (anchor required and skip cap 2 unchanged). No valid group:
-- no_group without a level band ("No even teams right now"; Call mixed).
--
-- order_teams is unchanged: it already uses the Mixed pairing (smallest team
-- difference, then fewer repeat partners) for every preset except Fair line.
-- create_session copies the club default without checking the value.
--
-- Backward compatible: mixed, same_level and fair_line behave exactly as
-- before (team_gap is only computed for 'balanced'); same signatures, grants,
-- SECURITY DEFINER and search_path = ''. The deployed app never sends
-- 'balanced'.

-- ===========================================================================
-- 1. THE PRESET
-- ===========================================================================

alter table public.sessions drop constraint if exists sessions_matchmaking_allowed;
alter table public.sessions add constraint sessions_matchmaking_allowed check (matchmaking in ('mixed', 'balanced', 'same_level', 'fair_line'));
alter table public.clubs drop constraint if exists clubs_default_matchmaking_allowed;
alter table public.clubs add constraint clubs_default_matchmaking_allowed check (default_matchmaking in ('mixed', 'balanced', 'same_level', 'fair_line'));

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
  if p_matchmaking is null or p_matchmaking not in ('mixed', 'balanced', 'same_level', 'fair_line') then
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
-- 2. TEAM GAP: the best pairing's difference in team totals
-- ===========================================================================

-- Levels of the 4 players (staying winners first). A null level counts as the
-- group's average (0 when nobody has a level), as in order_teams. With 2
-- staying winners the pairing is fixed (they are a team); otherwise the best
-- of the 3 pairings.
create or replace function private.team_gap(p_levels smallint[], p_stayed integer)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_avg numeric;
  v numeric[];
begin
  if cardinality(p_levels) <> 4 then
    return 0;
  end if;
  select avg(x) into v_avg from unnest(p_levels) x;
  v := array(select coalesce(x::numeric, v_avg, 0) from unnest(p_levels) with ordinality u(x, i) order by i);
  if p_stayed = 2 then
    return abs((v[1] + v[2]) - (v[3] + v[4]));
  end if;
  return least(abs((v[1] + v[2]) - (v[3] + v[4])), abs((v[1] + v[3]) - (v[2] + v[4])), abs((v[1] + v[4]) - (v[2] + v[3])));
end;
$$;

revoke execute on function private.team_gap(smallint[], integer) from public, anon, authenticated;

-- ===========================================================================
-- 3. GROUP SELECTION (same signature; mixed, same_level, fair_line unchanged)
-- ===========================================================================

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
  -- D29: Balanced teams (doubles): any levels within 3, teams within 1.
  v_balanced boolean;
begin
  select s.matchmaking into v_preset from public.sessions s where s.id = p_session_id;
  v_need := private.court_size(p_format) - cardinality(v_fixed);
  v_balanced := v_preset = 'balanced' and private.court_size(p_format) = 4;
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
             (select sum(x) from unnest(c.idx) x)::integer as pos_sum,
             -- D29: the best pairing's team difference (staying winners are a team).
             case when v_balanced
               then private.team_gap(v_fixed_skill || (select array_agg(w.skill order by w.i) from w where w.i = any (c.idx)), cardinality(v_fixed))
               else 0 end as gap
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
      where (case
               when v_balanced then (sc.hi is null or sc.hi - sc.lo <= 3) and sc.gap <= 1
               -- Balanced singles: as Mixed.
               when v_preset in ('mixed', 'balanced') then sc.hi is null or sc.hi - sc.lo <= 1
               else sc.hi is null or sc.hi = sc.lo end)
        and not exists (select 1 from w where not (w.i = any (sc.idx)) and w.i < sc.last_i and w.skip >= 2)
    )
  select v.idx, v.ids, v.lo, v.hi, v.repeats, v.last_i into v_best
  from valid v
  order by v.repeats * 10 + v.gap * 5 + v.pos_sum, v.idx
  limit 1;

  if v_best.idx is null and v_balanced then
    -- D29: no even teams; no level band to wait for ("Call mixed" starts anyway).
    return jsonb_build_object('status', 'no_group', 'preset', v_preset, 'anchor', v_ids[1]);
  end if;

  if v_best.idx is null then
    -- No valid group: the band the anchor (and any fixed players) could play in.
    -- Mixed: a level-3 anchor alone can play with 2-4; with a fixed level 4, 3-4.
    -- Same level: the anchor's level. No band when nobody has a level.
    select case when v_preset in ('mixed', 'balanced') then greatest(1, max(z.s) - 1) else max(z.s) end,
           case when v_preset in ('mixed', 'balanced') then least(5, min(z.s) + 1) else max(z.s) end
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

revoke execute on function private.select_group(uuid, text, uuid[], boolean) from public, anon, authenticated;
