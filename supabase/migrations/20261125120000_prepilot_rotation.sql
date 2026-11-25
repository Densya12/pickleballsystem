-- Pre-pilot: change a live session's rotation (D19 "After a game").
--
-- set_session_rotation(session, rotation): an organizer of the session's club
-- switches All off / Winners stay while the session is live. It takes effect
-- at the next Done. Every court's winner_streak goes back to 0, so a streak
-- counted under the old mode can't carry over. Idempotent: choosing the mode
-- the session already has changes nothing (safe to replay from the outbox).

create function public.set_session_rotation(p_session_id uuid, p_rotation text)
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

  update public.sessions set rotation = p_rotation where id = p_session_id;
  update public.courts set winner_streak = 0 where session_id = p_session_id;

  insert into public.events (session_id, actor, type, payload)
  values (p_session_id, auth.uid(), 'rotation_changed',
          jsonb_build_object('from', v_session.rotation, 'to', p_rotation));
end;
$$;

revoke execute on function public.set_session_rotation(uuid, text) from public, anon, authenticated;
grant execute on function public.set_session_rotation(uuid, text) to authenticated;
