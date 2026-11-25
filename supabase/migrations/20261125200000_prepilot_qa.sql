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
