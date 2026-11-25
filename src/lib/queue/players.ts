/**
 * Player input for the queue (walk-ins, BR20). The database checks the same
 * rules; this layer gives a message per field, in the device's language.
 */
import type { Dictionary } from "@/lib/i18n/dictionary";
import { toParseResult, type ParseResult } from "@/lib/club/validation";
import { normalizeReference, REFERENCE_MAX, REFERENCE_MIN } from "@/lib/payments/reference";

export const PLAYER_NAME_MIN = 2;
export const PLAYER_NAME_MAX = 40;

export const LEVEL_VALUES = ["beginner", "intermediate", "advanced", "unsure"] as const;
export type Level = (typeof LEVEL_VALUES)[number];

/** All four levels (organizer forms), or the three the player can pick ("unsure" when none). */
export function levelChoices(t: Dictionary, { withUnsure = true }: { withUnsure?: boolean } = {}): { value: Level; label: string }[] {
  return LEVEL_VALUES.filter((v) => withUnsure || v !== "unsure").map((value) => ({ value, label: t.levels[value] }));
}

export function levelLabel(level: string, t: Dictionary): string {
  return (LEVEL_VALUES as readonly string[]).includes(level) ? t.levels[level as Level] : level;
}


export type WalkInInput = { display_name: string; level: Level };

type FormLike = { get(name: string): FormDataEntryValue | null };

/** Same tidy-up as the database trigger: trim and collapse spaces. */
export function tidyName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

export function parseWalkIn(form: FormLike, t: Dictionary): ParseResult<WalkInInput> {
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
          ? t.live.nameRequired
          : length < PLAYER_NAME_MIN
            ? t.live.nameTooShort(PLAYER_NAME_MIN)
            : length > PLAYER_NAME_MAX
              ? t.live.nameTooLong(PLAYER_NAME_MAX)
              : undefined,
      level: (LEVEL_VALUES as readonly string[]).includes(level) ? undefined : t.live.levelInvalid,
    },
  );
}

/**
 * Walk-in payment (BR13/BR20, D18). With a fee there is no default: the
 * organizer picks one, so a walk-in is never held under pay_first by accident.
 */
export const WALK_IN_PAYMENTS = ["cash_received", "gcash", "later"] as const;
export type WalkInPayment = (typeof WALK_IN_PAYMENTS)[number];

/**
 * QA-05: how names are compared for "already in line" (the same rule as
 * private.player_name_key in the database): lower case, no spaces.
 */
export function playerNameKey(name: string): string {
  return name.replace(/\s+/g, "").toLowerCase();
}

/** QA-05: checked in from a phone (not added by the organizer) in the last 10 minutes: "New". */
export function isNewCheckIn(player: { isWalkIn: boolean; joinedAt: string }, now: number): boolean {
  return !player.isWalkIn && now - Date.parse(player.joinedAt) < 10 * 60_000;
}

export function walkInPaymentChoices(t: Dictionary): { value: WalkInPayment; label: string }[] {
  return [
    { value: "cash_received", label: t.live.paidCash },
    { value: "gcash", label: t.live.gcash },
    { value: "later", label: t.live.payLater },
  ];
}

export type WalkInPaymentResult =
  | { ok: true; payment?: WalkInPayment }
  | { ok: false; errors: { payment?: string; reference?: string } };

/** No payment step when the session is free (fee 0). */
export function parseWalkInPayment(fee: number, payment: string, reference: string, t: Dictionary): WalkInPaymentResult {
  if (fee <= 0) return { ok: true };
  const choice = WALK_IN_PAYMENTS.find((value) => value === payment);
  if (!choice) return { ok: false, errors: { payment: t.live.choosePayment } };
  if (choice === "gcash" && !normalizeReference(reference)) {
    return { ok: false, errors: { reference: t.payments.invalidReference(REFERENCE_MIN, REFERENCE_MAX) } };
  }
  return { ok: true, payment: choice };
}
