"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { clubErrorMessage } from "@/lib/club/messages";
import { parseNewClub, type NewClubInput } from "@/lib/club/validation";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export type CreateClubState = {
  error?: string;
  fieldErrors?: Partial<Record<keyof NewClubInput, string>>;
  values?: { name: string; city: string };
};

export async function createClubAction(
  _prev: CreateClubState,
  formData: FormData,
): Promise<CreateClubState> {
  await requireUser("/club/new");
  const t = await getT();

  const values = {
    name: String(formData.get("name") ?? ""),
    city: String(formData.get("city") ?? ""),
  };
  const parsed = parseNewClub(formData, t);
  if (!parsed.ok) return { fieldErrors: parsed.errors, values };

  const supabase = await createClient();
  const { data: clubId, error } = await supabase.rpc("create_club", {
    p_name: parsed.data.name,
    p_city: parsed.data.city ?? undefined,
  });
  if (error) return { error: clubErrorMessage(error, t), values };
  // D25: new clubs start on Mixed. (The column's default stays Fair line, so a club
  // created by an older app keeps today's behavior.) A failure here keeps Fair line.
  if (clubId) await supabase.from("clubs").update({ default_matchmaking: "mixed" }).eq("id", clubId);

  redirect("/");
}
