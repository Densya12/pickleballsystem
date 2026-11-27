import type { Dictionary } from "@/lib/i18n/dictionary";
import { formatPeso } from "@/lib/format";
import { formatAccountNumber, methodName, type PayTo } from "./method";
import { REFERENCE_MAX, REFERENCE_MIN } from "./reference";

/** "Paalalahanan": the message the organizer shares or copies, in the device's language. */
export function reminderMessage(
  input: { name: string; session: string; fee: number; payTo: PayTo },
  t: Dictionary,
): string {
  return t.payments.reminder({
    name: input.name,
    session: input.session,
    fee: formatPeso(input.fee),
    method: methodName(t, input.payTo),
    account: input.payTo.accountNumber
      ? [input.payTo.accountName, formatAccountNumber(input.payTo.accountNumber)].filter(Boolean).join(" ")
      : null,
  });
}

/** Player-facing payment status line. */
export function paymentStatusText(status: string, t: Dictionary): string {
  if (status === "confirmed") return t.payments.statusPaid;
  if (status === "pending") return t.payments.statusPending;
  return t.payments.statusUnpaid;
}

type DbErrorLike = { code?: string; message?: string };

/** Payment errors; null for anything else (the caller falls back to its own messages). */
export function paymentErrorMessage(error: DbErrorLike, t: Dictionary): string | null {
  switch (error.message) {
    case "invalid_reference":
      return t.payments.invalidReference(REFERENCE_MIN, REFERENCE_MAX);
    case "already_paid":
      return t.payments.alreadyPaid;
    case "no_payment_needed":
      return t.payments.notNeeded;
    case "invalid_payment_method":
      return t.payments.invalidMethod;
    case "invalid_payment_status":
      return t.payments.statusChanged;
    case "not_organizer_account":
      return t.auth.notOrganizerAccount;
  }
  return null;
}
