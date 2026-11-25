"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireClub } from "@/lib/auth/dal";
import { clubErrorMessage } from "@/lib/club/messages";
import { getT } from "@/lib/i18n/server";
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
  const t = await getT();
  const values = Object.fromEntries(FIELDS.map((f) => [f, String(formData.get(f) ?? "")]));

  if (role !== "owner") return { status: "error", message: t.club.ownerOnly, values };

  const parsed = parseClubSettings(formData, t);
  if (!parsed.ok) {
    return {
      status: "error",
      message: t.common.formError,
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

  if (error) return { status: "error", message: clubErrorMessage(error, t), values };
  // RLS turns a non-owner update into "0 rows" rather than an error.
  if (!data?.length) return { status: "error", message: t.club.ownerOnly, values };

  refresh();
  return { status: "saved", message: t.common.saved };
}

export type StaffActionResult = { error?: string; token?: string };

export async function createInviteAction(): Promise<StaffActionResult> {
  const { club, role } = await requireClub("/settings");
  const t = await getT();
  if (role !== "owner") return { error: t.club.ownerOnly };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_invites")
    .insert({ club_id: club.id })
    .select("token")
    .single();
  if (error) return { error: clubErrorMessage(error, t) };

  refresh();
  return { token: data.token };
}

export async function revokeInviteAction(inviteId: string): Promise<StaffActionResult> {
  const { club } = await requireClub("/settings");
  const t = await getT();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", inviteId)
    .eq("club_id", club.id)
    .select("id");
  if (error) return { error: clubErrorMessage(error, t) };
  if (!data?.length) return { error: t.club.ownerOnly };

  refresh();
  return {};
}

export async function removeStaffAction(userId: string): Promise<StaffActionResult> {
  const { club } = await requireClub("/settings");
  const t = await getT();
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_staff", { p_club_id: club.id, p_user_id: userId });
  if (error) return { error: clubErrorMessage(error, t) };

  refresh();
  return {};
}

/** "Replace QR": a new club entry code; printed copies of the old one stop working. */
export async function regenerateEntryCodeAction(): Promise<StaffActionResult> {
  const { club, role } = await requireClub("/settings");
  const t = await getT();
  if (role !== "owner") return { error: t.club.ownerOnly };

  const supabase = await createClient();
  const { error } = await supabase.rpc("regenerate_entry_code", { p_club_id: club.id });
  if (error) return { error: clubErrorMessage(error, t) };

  refresh();
  return {};
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
