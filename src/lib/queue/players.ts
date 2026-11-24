/**
 * Player input for the queue (walk-ins, BR20). The database checks the same
 * rules; this layer gives a Taglish message per field.
 */
import { toParseResult, type ParseResult } from "@/lib/club/validation";
import { normalizeReference, REFERENCE_MESSAGES } from "@/lib/payments/reference";

export const PLAYER_NAME_MIN = 2;
export const PLAYER_NAME_MAX = 40;

export const LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "unsure", label: "Hindi sigurado" },
] as const;
export type Level = (typeof LEVELS)[number]["value"];

export function levelLabel(level: string): string {
  return LEVELS.find((l) => l.value === level)?.label ?? level;
}

export const WALK_IN_MESSAGES = {
  nameRequired: "Pakilagay ang pangalan.",
  nameTooShort: `Masyadong maikli. Kahit ${PLAYER_NAME_MIN} letra.`,
  nameTooLong: `Hanggang ${PLAYER_NAME_MAX} letra lang.`,
  levelInvalid: "Pumili ng level.",
} as const;

export type WalkInInput = { display_name: string; level: Level };

type FormLike = { get(name: string): FormDataEntryValue | null };

/** Same tidy-up as the database trigger: trim and collapse spaces. */
export function tidyName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

export function parseWalkIn(form: FormLike): ParseResult<WalkInInput> {
  const rawName = form.get("display_name");
  const name = tidyName(typeof rawName === "string" ? rawName : "");
  const rawLevel = form.get("level");
  const level = typeof rawLevel === "string" ? rawLevel : "";
  const length = [...name].length;

  return toParseResult(
    { display_name: name, level: level as Level },
    {
      display_name:
        length === 0
          ? WALK_IN_MESSAGES.nameRequired
          : length < PLAYER_NAME_MIN
            ? WALK_IN_MESSAGES.nameTooShort
            : length > PLAYER_NAME_MAX
              ? WALK_IN_MESSAGES.nameTooLong
              : undefined,
      level: LEVELS.some((l) => l.value === level) ? undefined : WALK_IN_MESSAGES.levelInvalid,
    },
  );
}

/**
 * Walk-in payment (BR13/BR20, D18). With a fee there is no default: the
 * organizer picks one, so a walk-in is never held under pay_first by accident.
 */
export const WALK_IN_PAYMENT_CHOICES = [
  { value: "cash_received", label: "Nagbayad ng cash" },
  { value: "gcash", label: "GCash", description: "Ilagay ang reference number sa ibaba" },
  { value: "later", label: "Mamaya na magbabayad" },
] as const;
export type WalkInPayment = (typeof WALK_IN_PAYMENT_CHOICES)[number]["value"];

export const WALK_IN_PAYMENT_REQUIRED = "Pumili kung paano magbabayad.";

export type WalkInPaymentResult =
  | { ok: true; payment?: WalkInPayment }
  | { ok: false; errors: { payment?: string; reference?: string } };

/** No payment step when the session is free (fee 0). */
export function parseWalkInPayment(fee: number, payment: string, reference: string): WalkInPaymentResult {
  if (fee <= 0) return { ok: true };
  const choice = WALK_IN_PAYMENT_CHOICES.find((c) => c.value === payment)?.value;
  if (!choice) return { ok: false, errors: { payment: WALK_IN_PAYMENT_REQUIRED } };
  if (choice === "gcash" && !normalizeReference(reference)) {
    return { ok: false, errors: { reference: REFERENCE_MESSAGES.invalid } };
  }
  return { ok: true, payment: choice };
}
