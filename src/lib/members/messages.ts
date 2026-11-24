import { queueErrorMessage } from "@/lib/queue/messages";

export const MEMBER_ERRORS = {
  notFound: "Wala na ang member na iyon. I-refresh ang page.",
  generic: "Hindi ma-save ang member. Subukan ulit.",
} as const;

type DbErrorLike = { code?: string; message?: string };

export function memberErrorMessage(error: DbErrorLike): string {
  if (error.message === "member_not_found") return MEMBER_ERRORS.notFound;
  if (error.code === "42501") return MEMBER_ERRORS.generic;
  return queueErrorMessage(error);
}
