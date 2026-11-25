import type { Dictionary } from "@/lib/i18n/dictionary";
import { queueErrorMessage } from "@/lib/queue/messages";

type DbErrorLike = { code?: string; message?: string };

export function memberErrorMessage(error: DbErrorLike, t: Dictionary): string {
  if (error.message === "member_not_found") return t.members.notFound;
  if (error.code === "42501") return t.members.saveFailed;
  return queueErrorMessage(error, t);
}
