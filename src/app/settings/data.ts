import "server-only";
import { requireClub } from "@/lib/auth/dal";

/** The club's settings as the form strings (Settings › Club details). */
export async function getClubFormValues() {
  const { club, role } = await requireClub("/settings");
  return {
    club,
    isOwner: role === "owner",
    values: {
      name: club.name,
      city: club.city ?? "",
      gcash_name: club.gcash_name ?? "",
      gcash_number: club.gcash_number ?? "",
      default_fee: String(club.default_fee),
      payment_method: club.payment_method,
      payment_method_other: club.payment_method_other ?? "",
      cash_accepted: club.cash_accepted ? "on" : "off",
      default_points: String(club.default_points),
      default_rotation: club.default_rotation,
      default_matchmaking: club.default_matchmaking,
      default_call_mode: club.default_call_mode,
    },
  };
}

export type ClubValues = Awaited<ReturnType<typeof getClubFormValues>>["values"];
