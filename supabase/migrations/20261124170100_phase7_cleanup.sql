-- Phase 7: daily cleanup.
--
-- 1. Anonymous (player) auth users with no activity for 30 days and no
--    non-left row in a live session. session_players.user_id is
--    "on delete set null", so their history rows (names, games, payments) stay.
--    "Activity" is the latest of: account created, last sign-in, last
--    check-in. Weekly regulars keep their account, so "Pumila bilang …"
--    (my_last_profile) keeps working for them.
-- 2. private.session_changes rows (the undo change counter) whose session no
--    longer exists.
--
-- Runs every day at 03:00 Manila (19:00 UTC) with pg_cron. To run it by hand
-- (Supabase SQL editor): select private.cleanup_stale_data();

create function private.cleanup_stale_data()
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_users integer;
  v_changes integer;
begin
  delete from auth.users u
  where u.is_anonymous
    and greatest(
          u.created_at,
          coalesce(u.last_sign_in_at, u.created_at),
          coalesce((select max(p.created_at) from public.session_players p where p.user_id = u.id), u.created_at)
        ) < now() - interval '30 days'
    and not exists (
      select 1
      from public.session_players p
      join public.sessions s on s.id = p.session_id
      where p.user_id = u.id and p.status <> 'left' and s.status = 'live'
    );
  get diagnostics v_users = row_count;

  delete from private.session_changes c
  where not exists (select 1 from public.sessions s where s.id = c.session_id);
  get diagnostics v_changes = row_count;

  return jsonb_build_object('anonymous_users_deleted', v_users, 'session_changes_deleted', v_changes);
end;
$$;

revoke execute on function private.cleanup_stale_data() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;

-- Same name again replaces the schedule, so re-running this is safe.
select cron.schedule('opq-daily-cleanup', '0 19 * * *', 'select private.cleanup_stale_data()');
