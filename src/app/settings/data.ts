import "server-only";
import { requireClub } from "@/lib/auth/dal";

/** The club's settings as the form strings (club details and GCash pages). */
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
      default_points: String(club.default_points),
      default_rotation: club.default_rotation,
    },
  };
}

export type ClubValues = Awaited<ReturnType<typeof getClubFormValues>>["values"];
