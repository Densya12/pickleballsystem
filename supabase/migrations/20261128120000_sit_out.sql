-- D26 follow-up: a staying winner can sit out the next game.
--
-- Under "Wait for me" with Winners stay, the staying winners are 'playing'
-- (courts.staying_ids) and can't rest. public.sit_out sends one of them to the
-- back of the line: the player themselves ("Sit out this game" on the phone) or
-- the club's staff ("Send to line" on the court). The pair is broken, so the
-- court's winner_streak resets to 0; any other winner keeps staying and Call
-- fills the free spots with the D25 selection (the remaining stayer is the
-- fixed member). Logged ('sat_out'); not undoable, like the side swap.
--
-- New function only: no existing function, table or grant changes, so the
-- deployed app keeps working between db push and merge.

create or replace function public.sit_out(p_player_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.assert_signed_in();
  v_session_id uuid;
  v_club_id uuid;
  v_own boolean;
  v_status text;
  v_court public.courts%rowtype;
  v_event_court uuid;
begin
  select p.session_id, s.club_id, p.user_id is not distinct from v_uid
  into v_session_id, v_club_id, v_own
  from public.session_players p join public.sessions s on s.id = p.session_id
  where p.id = p_player_id;
  -- The player for themselves; the club's staff for anyone.
  if not found or not (v_own or public.is_club_staff(v_club_id)) then
    raise exception 'player_not_found' using errcode = 'P0001';
  end if;
  if not v_own then
    perform private.assert_organizer_account();
  end if;

  -- Lock order as everywhere: the session, then the court, then the player.
  select s.status into v_status from public.sessions s where s.id = v_session_id for update;
  if v_status <> 'live' then
    raise exception 'session_not_live' using errcode = 'P0001';
  end if;

  select * into v_court from public.courts c
  where c.session_id = v_session_id and p_player_id = any (c.staying_ids)
  for update;

  if not found then
    -- Idempotent (outbox resends, double taps): already sat out since their last
    -- game started, so nothing to do. Anyone else isn't staying.
    select (e.payload ->> 'court_id')::uuid into v_event_court
    from public.events e
    where e.session_id = v_session_id and e.type = 'sat_out' and e.payload ->> 'player_id' = p_player_id::text
      and e.created_at >= coalesce((select max(g.started_at) from public.games g
                                    where g.session_id = v_session_id and p_player_id = any (g.player_ids)), '-infinity')
    order by e.created_at desc
    limit 1;
    if v_event_court is not null then
      return v_event_court;
    end if;
    raise exception 'player_not_staying' using errcode = 'P0001';
  end if;

  perform 1 from public.session_players p where p.id = p_player_id for update;
  -- To the back of the line, like anyone who just finished a game.
  perform private.requeue(array[p_player_id]);
  update public.courts
  set staying_ids = array_remove(staying_ids, p_player_id), winner_streak = 0
  where id = v_court.id;

  insert into public.events (session_id, actor, type, payload)
  values (v_session_id, v_uid, 'sat_out', jsonb_build_object(
    'court_id', v_court.id, 'player_id', p_player_id, 'by', case when v_own then 'player' else 'staff' end));

  return v_court.id;
end;
$$;

revoke execute on function public.sit_out(uuid) from public, anon, authenticated;
grant execute on function public.sit_out(uuid) to authenticated;
