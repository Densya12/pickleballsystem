/**
 * Club input validation, shared by forms (client) and Server Actions (server).
 * The database enforces the same rules with CHECK constraints; this layer
 * exists to give a clear message per field, in the device's language.
 */
import type { Dictionary } from "@/lib/i18n/dictionary";
import { isPaymentMethod, OTHER_NAME_MAX, OTHER_NAME_MIN, usesMobileNumber, type PaymentMethod } from "@/lib/payments/method";

export const CLUB_NAME_MIN = 2;
export const CLUB_NAME_MAX = 60;
export const CITY_MAX = 60;
/** The account name and number columns keep their old names (gcash_name, gcash_number) for any method. */
export const GCASH_NAME_MAX = 80;
export const ACCOUNT_NUMBER_MIN = 4;
export const ACCOUNT_NUMBER_MAX = 30;
export const FEE_MAX = 100_000;

export const POINTS_OPTIONS = [11, 15, 21] as const;
export type Points = (typeof POINTS_OPTIONS)[number];

export const ROTATION_OPTIONS = ["all_off", "winners_stay"] as const;
export type Rotation = (typeof ROTATION_OPTIONS)[number];

/** D25: who plays together. New clubs start on Mixed; existing ones were moved to Fair line. D29 adds Balanced teams. */
export const MATCHMAKING_OPTIONS = ["mixed", "balanced", "same_level", "fair_line"] as const;
export type Matchmaking = (typeof MATCHMAKING_OPTIONS)[number];

/** D26: after Done, wait for the organizer's Call (new clubs) or call the next group at once (existing ones). */
export const CALL_MODE_OPTIONS = ["wait", "auto_call"] as const;
export type CallMode = (typeof CALL_MODE_OPTIONS)[number];


type FormLike = { get(name: string): FormDataEntryValue | null };

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: Partial<Record<keyof T, string>> };

function text(form: FormLike, field: string): string {
  const value = form.get(field);
  return typeof value === "string" ? value.trim() : "";
}

/** Strips spaces and dashes ("0917-123 4567" → "09171234567"). Blank → null. */
export function normalizeGcashNumber(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/[\s-]/g, "");
  return digits === "" ? null : digits;
}

export function isValidGcashNumber(normalized: string): boolean {
  return /^09\d{9}$/.test(normalized);
}

/** GCash and Maya: a mobile number. Bank and other accounts: 4-30 digits. Mirrors clubs_gcash_number_format. */
export function accountNumberError(method: PaymentMethod, normalized: string | null, t: Dictionary): string | undefined {
  if (normalized === null) return undefined;
  if (usesMobileNumber(method)) return isValidGcashNumber(normalized) ? undefined : t.club.mobileNumberInvalid;
  return new RegExp(`^\\d{${ACCOUNT_NUMBER_MIN},${ACCOUNT_NUMBER_MAX}}$`).test(normalized)
    ? undefined
    : t.club.accountNumberInvalid(ACCOUNT_NUMBER_MIN, ACCOUNT_NUMBER_MAX);
}

export function validateClubName(name: string, t: Dictionary): string | undefined {
  const length = [...name].length;
  if (length === 0) return t.club.nameRequired;
  if (length < CLUB_NAME_MIN) return t.club.nameTooShort(CLUB_NAME_MIN);
  if (length > CLUB_NAME_MAX) return t.club.tooLong(CLUB_NAME_MAX);
  return undefined;
}

function maxLength(value: string | null, max: number, message: string): string | undefined {
  return value && [...value].length > max ? message : undefined;
}

export type NewClubInput = { name: string; city: string | null };

export function parseNewClub(form: FormLike, t: Dictionary): ParseResult<NewClubInput> {
  const name = text(form, "name");
  const city = text(form, "city") || null;

  const errors: Partial<Record<keyof NewClubInput, string>> = {
    name: validateClubName(name, t),
    city: maxLength(city, CITY_MAX, t.club.tooLong(CITY_MAX)),
  };
  return toParseResult({ name, city }, errors);
}

export type ClubSettingsInput = {
  name: string;
  city: string | null;
  gcash_name: string | null;
  gcash_number: string | null;
  default_fee: number;
  payment_method: PaymentMethod;
  payment_method_other: string | null;
  cash_accepted: boolean;
  default_points: Points;
  default_rotation: Rotation;
  default_matchmaking: Matchmaking;
  default_call_mode: CallMode;
};

export function parseClubSettings(form: FormLike, t: Dictionary): ParseResult<ClubSettingsInput> {
  const name = text(form, "name");
  const city = text(form, "city") || null;
  const gcashName = text(form, "gcash_name") || null;
  const gcashNumber = normalizeGcashNumber(text(form, "gcash_number"));
  const feeRaw = text(form, "default_fee");
  const methodRaw = text(form, "payment_method");
  const method: PaymentMethod = isPaymentMethod(methodRaw) ? methodRaw : "gcash";
  const otherName = method === "other" ? text(form, "payment_method_other") || null : null;
  const otherLength = otherName ? [...otherName].length : 0;
  const cashRaw = text(form, "cash_accepted");
  const pointsRaw = Number(text(form, "default_points"));
  const rotationRaw = text(form, "default_rotation");
  const matchmakingRaw = text(form, "default_matchmaking");
  const callModeRaw = text(form, "default_call_mode");

  const fee = /^\d+$/.test(feeRaw) ? Number(feeRaw) : Number.NaN;

  const errors: Partial<Record<keyof ClubSettingsInput, string>> = {
    name: validateClubName(name, t),
    city: maxLength(city, CITY_MAX, t.club.tooLong(CITY_MAX)),
    gcash_name: maxLength(gcashName, GCASH_NAME_MAX, t.club.tooLong(GCASH_NAME_MAX)),
    gcash_number: accountNumberError(method, gcashNumber, t),
    payment_method: isPaymentMethod(methodRaw) ? undefined : t.club.paymentMethodInvalid,
    payment_method_other:
      method === "other" && (otherLength < OTHER_NAME_MIN || otherLength > OTHER_NAME_MAX)
        ? t.club.otherNameInvalid(OTHER_NAME_MIN, OTHER_NAME_MAX)
        : undefined,
    cash_accepted: cashRaw === "on" || cashRaw === "off" ? undefined : t.club.cashAcceptedInvalid,
    default_fee: Number.isNaN(fee) ? t.club.feeInvalid : fee > FEE_MAX ? t.club.feeTooHigh : undefined,
    default_points: (POINTS_OPTIONS as readonly number[]).includes(pointsRaw) ? undefined : t.club.pointsInvalid,
    default_rotation: (ROTATION_OPTIONS as readonly string[]).includes(rotationRaw) ? undefined : t.club.rotationInvalid,
    default_matchmaking: (MATCHMAKING_OPTIONS as readonly string[]).includes(matchmakingRaw) ? undefined : t.club.matchmakingInvalid,
    default_call_mode: (CALL_MODE_OPTIONS as readonly string[]).includes(callModeRaw) ? undefined : t.club.callModeInvalid,
  };

  return toParseResult(
    {
      name,
      city,
      gcash_name: gcashName,
      gcash_number: gcashNumber,
      default_fee: fee,
      payment_method: method,
      payment_method_other: otherName,
      cash_accepted: cashRaw !== "off",
      default_points: pointsRaw as Points,
      default_rotation: rotationRaw as Rotation,
      default_matchmaking: matchmakingRaw as Matchmaking,
      default_call_mode: callModeRaw as CallMode,
    },
    errors,
  );
}

/** Drops undefined messages; no messages left means the input is valid. */
export function toParseResult<T>(data: T, errors: Partial<Record<keyof T, string | undefined>>): ParseResult<T> {
  const present = Object.fromEntries(
    Object.entries(errors).filter(([, message]) => message !== undefined),
  ) as Partial<Record<keyof T, string>>;
  return Object.keys(present).length === 0 ? { ok: true, data } : { ok: false, errors: present };
}
