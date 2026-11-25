import "server-only";
import { requireUser } from "@/lib/auth/dal";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { getT } from "@/lib/i18n/server";
import { getSession } from "@/lib/session/data";

/**
 * Every session action re-checks the user and that they can see the session
 * (staff of its club, via RLS); the RPCs check staff, anonymous sessions and
 * status again. Returns the dictionary for messages, or an error.
 */
export async function authorizeSession(sessionId: string): Promise<{ t: Dictionary; error?: string }> {
  await requireUser(`/s/${encodeURIComponent(sessionId)}`);
  const t = await getT();
  return (await getSession(sessionId)) ? { t } : { t, error: t.session.notFound };
}
