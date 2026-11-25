"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { clubErrorMessage } from "@/lib/club/messages";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export type JoinState = { error?: string };

/** Bound with the token; useActionState passes (prevState, formData), which are unused. */
export async function acceptInviteAction(token: string): Promise<JoinState> {
  await requireUser(`/invite/${encodeURIComponent(token)}`);

  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invite", { p_token: token });
  if (error) return { error: clubErrorMessage(error, await getT()) };

  redirect("/");
}
