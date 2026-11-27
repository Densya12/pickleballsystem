/**
 * Player input for the queue (walk-ins, BR20). The database checks the same
 * rules; this layer gives a message per field, in the device's language.
 */
import type { Dictionary } from "@/lib/i18n/dictionary";
import { cleanDisplayName, hasLetterOrNumber } from "@/lib/names";
import { toParseResult, type ParseResult } from "@/lib/club/validation";
import { methodName, type PayTo } from "@/lib/payments/method";
import { normalizeReference, REFERENCE_MAX, REFERENCE_MIN } from "@/lib/payments/reference";

export const PLAYER_NAME_MIN = 2;
export const PLAYER_NAME_MAX = 40;

/** D25: level 1-5, or "unsure" (not set). Sent as text; the database maps it to skill 1-5. */
export const LEVEL_VALUES = ["1", "2", "3", "4", "5", "unsure"] as const;
export type Level = (typeof LEVEL_VALUES)[number];
export const LEVEL_NUMBERS = [1, 2, 3, 4, 5] as const;

/** A database skill (1-5 or null) as a form value. */
export function levelFromSkill(skill: number | null | undefined): Level {
  return skill && skill >= 1 && skill <= 5 ? (String(skill) as Level) : "unsure";
}

/** The level as a number, or null when not set. */
export function levelNumber(level: string | null | undefined): number | null {
  return level && /^[1-5]$/.test(level) ? Number(level) : null;
}

/** "Level 3", or "Not set". */
export function levelLabel(level: string, t: Dictionary): string {
  const n = levelNumber(level);
  return n === null ? t.levels.notSet : t.levels.level(n);
}

export type WalkInInput = { display_name: string; level: Level };

type FormLike = { get(name: string): FormDataEntryValue | null };

/** QA-07: the database trigger's tidy-up (src/lib/names.ts): no invisible characters, spaces joined, trimmed. */
export function tidyName(raw: string): string {
  return cleanDisplayName(raw);
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
              : !hasLetterOrNumber(name)
                ? t.live.nameNeedsLetter
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
/** "gcash" means paid to the club's account, whatever its method (GCash, Maya, bank or other). */
export type WalkInPayment = (typeof WALK_IN_PAYMENTS)[number];

/**
 * QA-05: how names are compared for "already in line" (the same rule as
 * private.player_name_key in the database): lower case, no spaces.
 */
export function playerNameKey(name: string): string {
  return cleanDisplayName(name).replace(/\s+/g, "").toLowerCase();
}

/** QA-05: checked in from a phone (not added by the organizer) in the last 10 minutes: "New". */
export function isNewCheckIn(player: { isWalkIn: boolean; joinedAt: string }, now: number): boolean {
  return !player.isWalkIn && now - Date.parse(player.joinedAt) < 10 * 60_000;
}

/** The club's method by name; no cash choice when the club doesn't take cash. */
export function walkInPaymentChoices(t: Dictionary, payTo: Pick<PayTo, "method" | "otherName" | "cashAccepted">): { value: WalkInPayment; label: string }[] {
  return [
    ...(payTo.cashAccepted ? [{ value: "cash_received" as const, label: t.live.paidCash }] : []),
    { value: "gcash", label: methodName(t, payTo) },
    { value: "later", label: t.live.payLater },
  ];
}

export type WalkInPaymentResult =
  | { ok: true; payment?: WalkInPayment }
  | { ok: false; errors: { payment?: string; reference?: string } };

/** No payment step when the session is free (fee 0). */
export function parseWalkInPayment(
  fee: number,
  payment: string,
  reference: string,
  t: Dictionary,
  payTo?: Pick<PayTo, "method" | "otherName" | "cashAccepted">,
): WalkInPaymentResult {
  if (fee <= 0) return { ok: true };
  const choice = WALK_IN_PAYMENTS.find((value) => value === payment);
  if (!choice) return { ok: false, errors: { payment: t.live.choosePayment } };
  if (choice === "cash_received" && payTo && !payTo.cashAccepted) {
    return { ok: false, errors: { payment: t.payments.cashNotAccepted(methodName(t, payTo)) } };
  }
  if (choice === "gcash" && !normalizeReference(reference)) {
    return { ok: false, errors: { reference: t.payments.invalidReference(REFERENCE_MIN, REFERENCE_MAX) } };
  }
  return { ok: true, payment: choice };
}
