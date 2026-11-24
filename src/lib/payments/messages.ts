import { AUTH_MESSAGES } from "@/lib/auth/messages";
import { formatGcashNumber, formatPeso } from "@/lib/format";
import { REFERENCE_MESSAGES } from "./reference";

/** "Paalalahanan": the message the organizer shares or copies. */
export function reminderMessage(input: {
  name: string;
  session: string;
  fee: number;
  gcashName: string | null;
  gcashNumber: string | null;
}): string {
  const gcash = [input.gcashName, input.gcashNumber ? formatGcashNumber(input.gcashNumber) : null].filter(Boolean).join(" ");
  return `Hi ${input.name}! Paalala lang po sa bayad para sa ${input.session}: ${formatPeso(input.fee)}.${
    gcash ? ` GCash: ${gcash}.` : ""
  } Salamat po!`;
}

/** Player-facing payment status line (Pwesto). */
export function paymentStatusText(status: string): string {
  if (status === "confirmed") return "Bayad na";
  if (status === "pending") return "Hinihintay ang kumpirmasyon ng organizer";
  return "Hindi pa bayad";
}

export function confirmedBanner(name: string, method: "gcash" | "cash"): string {
  return method === "cash" ? `Natanggap ang cash ni ${name}.` : `Kumpirmado ang GCash ni ${name}.`;
}

export function undoneBanner(name: string): string {
  return `Ibinalik sa hindi pa bayad si ${name}.`;
}

export const PAYMENT_ERRORS = {
  invalidReference: REFERENCE_MESSAGES.invalid,
  alreadyPaid: "Bayad na ito. I-refresh ang page.",
  notNeeded: "Libre ang session na ito; walang bayad.",
  invalidMethod: "Pumili kung GCash o cash.",
  statusChanged: "Nagbago na ang bayad na ito. I-refresh ang page.",
} as const;

type DbErrorLike = { code?: string; message?: string };

/** Payment errors; null for anything else (the caller falls back to its own messages). */
export function paymentErrorMessage(error: DbErrorLike): string | null {
  switch (error.message) {
    case "invalid_reference":
      return PAYMENT_ERRORS.invalidReference;
    case "already_paid":
      return PAYMENT_ERRORS.alreadyPaid;
    case "no_payment_needed":
      return PAYMENT_ERRORS.notNeeded;
    case "invalid_payment_method":
      return PAYMENT_ERRORS.invalidMethod;
    case "invalid_payment_status":
      return PAYMENT_ERRORS.statusChanged;
    case "not_organizer_account":
      return AUTH_MESSAGES.notOrganizerAccount;
  }
  return null;
}
