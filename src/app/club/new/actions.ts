"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { clubErrorMessage } from "@/lib/club/messages";
import { parseNewClub, type NewClubInput } from "@/lib/club/validation";
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

  const values = {
    name: String(formData.get("name") ?? ""),
    city: String(formData.get("city") ?? ""),
  };
  const parsed = parseNewClub(formData);
  if (!parsed.ok) return { fieldErrors: parsed.errors, values };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_club", {
    p_name: parsed.data.name,
    p_city: parsed.data.city ?? undefined,
  });
  if (error) return { error: clubErrorMessage(error), values };

  redirect("/");
}
