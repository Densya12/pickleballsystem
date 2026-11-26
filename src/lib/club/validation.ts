/**
 * Club input validation, shared by forms (client) and Server Actions (server).
 * The database enforces the same rules with CHECK constraints; this layer
 * exists to give a clear message per field, in the device's language.
 */
import type { Dictionary } from "@/lib/i18n/dictionary";

export const CLUB_NAME_MIN = 2;
export const CLUB_NAME_MAX = 60;
export const CITY_MAX = 60;
export const GCASH_NAME_MAX = 80;
export const FEE_MAX = 100_000;

export const POINTS_OPTIONS = [11, 15, 21] as const;
export type Points = (typeof POINTS_OPTIONS)[number];

export const ROTATION_OPTIONS = ["all_off", "winners_stay"] as const;
export type Rotation = (typeof ROTATION_OPTIONS)[number];

/** D25: who plays together. New clubs start on Mixed; existing ones were moved to Fair line. */
export const MATCHMAKING_OPTIONS = ["mixed", "same_level", "fair_line"] as const;
export type Matchmaking = (typeof MATCHMAKING_OPTIONS)[number];


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
  default_points: Points;
  default_rotation: Rotation;
  default_matchmaking: Matchmaking;
};

export function parseClubSettings(form: FormLike, t: Dictionary): ParseResult<ClubSettingsInput> {
  const name = text(form, "name");
  const city = text(form, "city") || null;
  const gcashName = text(form, "gcash_name") || null;
  const gcashNumber = normalizeGcashNumber(text(form, "gcash_number"));
  const feeRaw = text(form, "default_fee");
  const pointsRaw = Number(text(form, "default_points"));
  const rotationRaw = text(form, "default_rotation");
  const matchmakingRaw = text(form, "default_matchmaking");

  const fee = /^\d+$/.test(feeRaw) ? Number(feeRaw) : Number.NaN;

  const errors: Partial<Record<keyof ClubSettingsInput, string>> = {
    name: validateClubName(name, t),
    city: maxLength(city, CITY_MAX, t.club.tooLong(CITY_MAX)),
    gcash_name: maxLength(gcashName, GCASH_NAME_MAX, t.club.tooLong(GCASH_NAME_MAX)),
    gcash_number:
      gcashNumber !== null && !isValidGcashNumber(gcashNumber) ? t.club.gcashNumberInvalid : undefined,
    default_fee: Number.isNaN(fee) ? t.club.feeInvalid : fee > FEE_MAX ? t.club.feeTooHigh : undefined,
    default_points: (POINTS_OPTIONS as readonly number[]).includes(pointsRaw) ? undefined : t.club.pointsInvalid,
    default_rotation: (ROTATION_OPTIONS as readonly string[]).includes(rotationRaw) ? undefined : t.club.rotationInvalid,
    default_matchmaking: (MATCHMAKING_OPTIONS as readonly string[]).includes(matchmakingRaw) ? undefined : t.club.matchmakingInvalid,
  };

  return toParseResult(
    {
      name,
      city,
      gcash_name: gcashName,
      gcash_number: gcashNumber,
      default_fee: fee,
      default_points: pointsRaw as Points,
      default_rotation: rotationRaw as Rotation,
      default_matchmaking: matchmakingRaw as Matchmaking,
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
