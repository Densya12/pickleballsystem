"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireClub } from "@/lib/auth/dal";
import { CLUB_ERRORS, clubErrorMessage } from "@/lib/club/messages";
import { parseClubSettings, type ClubSettingsInput } from "@/lib/club/validation";
import { createClient } from "@/lib/supabase/server";

export type SettingsState = {
  status: "idle" | "saved" | "error";
  message?: string;
  fieldErrors?: Partial<Record<keyof ClubSettingsInput, string>>;
  /** Raw submitted values, so the form keeps what was typed after an error. */
  values?: Record<string, string>;
};

const FIELDS = [
  "name",
  "city",
  "gcash_name",
  "gcash_number",
  "default_fee",
  "default_points",
  "default_rotation",
] as const;

export async function saveSettingsAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const { club, role } = await requireClub("/settings");
  const values = Object.fromEntries(FIELDS.map((f) => [f, String(formData.get(f) ?? "")]));

  if (role !== "owner") return { status: "error", message: CLUB_ERRORS.ownerOnly, values };

  const parsed = parseClubSettings(formData);
  if (!parsed.ok) {
    return {
      status: "error",
      message: "May mali sa form. I-check ang mga naka-pula.",
      fieldErrors: parsed.errors,
      values,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clubs")
    .update(parsed.data)
    .eq("id", club.id)
    .select("id");

  if (error) return { status: "error", message: clubErrorMessage(error), values };
  // RLS turns a non-owner update into "0 rows" rather than an error.
  if (!data?.length) return { status: "error", message: CLUB_ERRORS.ownerOnly, values };

  refresh();
  return { status: "saved", message: "Na-save na." };
}

export type StaffActionResult = { error?: string; token?: string };

export async function createInviteAction(): Promise<StaffActionResult> {
  const { club, role } = await requireClub("/settings");
  if (role !== "owner") return { error: CLUB_ERRORS.ownerOnly };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_invites")
    .insert({ club_id: club.id })
    .select("token")
    .single();
  if (error) return { error: clubErrorMessage(error) };

  refresh();
  return { token: data.token };
}

export async function revokeInviteAction(inviteId: string): Promise<StaffActionResult> {
  const { club } = await requireClub("/settings");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", inviteId)
    .eq("club_id", club.id)
    .select("id");
  if (error) return { error: clubErrorMessage(error) };
  if (!data?.length) return { error: CLUB_ERRORS.ownerOnly };

  refresh();
  return {};
}

export async function removeStaffAction(userId: string): Promise<StaffActionResult> {
  const { club } = await requireClub("/settings");
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_staff", { p_club_id: club.id, p_user_id: userId });
  if (error) return { error: clubErrorMessage(error) };

  refresh();
  return {};
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
