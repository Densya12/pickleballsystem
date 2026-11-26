/**
 * New-session input (BR2), shared by the form and its Server Action. The
 * database checks the same rules; this layer gives a message per field, in
 * the device's language.
 */
import {
  FEE_MAX,
  POINTS_OPTIONS,
  MATCHMAKING_OPTIONS,
  ROTATION_OPTIONS,
  toParseResult,
  type Matchmaking,
  type ParseResult,
  type Points,
  type Rotation,
} from "@/lib/club/validation";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { parseManilaLocal } from "./time";

export const SESSION_NAME_MIN = 2;
export const SESSION_NAME_MAX = 60;
export const COURTS_MIN = 1;
export const COURTS_MAX = 8;
export const COURTS_DEFAULT = 2;

export const COURT_FORMATS = ["doubles", "singles"] as const;
export type CourtFormat = (typeof COURT_FORMATS)[number];
export function courtFormatChoices(t: Dictionary): { value: CourtFormat; label: string }[] {
  return [
    { value: "doubles", label: t.choices.doubles },
    { value: "singles", label: t.choices.singles },
  ];
}

export function courtFormatLabel(format: string, t: Dictionary): string {
  return format === "singles" ? t.choices.singles : t.choices.doubles;
}

/** Players per game: 2 singles, 4 doubles (mirrors private.court_size). */
export function courtSize(format: string): number {
  return format === "singles" ? 2 : 4;
}


/** Form field names (also the keys for field errors and kept values). */
export const SESSION_FIELDS = [
  "name",
  "starts_at",
  "ends_at",
  "courts_count",
  "points_to",
  "rotation",
  "matchmaking",
  "pay_first",
  "fee",
  /** Comma-separated, one per court (form fields court_format_1..N). */
  "court_formats",
] as const;
export type SessionField = (typeof SESSION_FIELDS)[number];

export type NewSessionInput = {
  name: string;
  /** ISO 8601 (UTC) */
  starts_at: string;
  ends_at: string;
  courts_count: number;
  points_to: Points;
  rotation: Rotation;
  matchmaking: Matchmaking;
  pay_first: boolean;
  fee: number;
  court_formats: CourtFormat[];
};

type FormLike = { get(name: string): FormDataEntryValue | null };

function text(form: FormLike, field: string): string {
  const value = form.get(field);
  return typeof value === "string" ? value.trim() : "";
}

export function parseNewSession(form: FormLike, t: Dictionary): ParseResult<NewSessionInput> {
  const name = text(form, "name");
  const nameLength = [...name].length;
  const startsAt = parseManilaLocal(text(form, "starts_at"));
  const endsAt = parseManilaLocal(text(form, "ends_at"));
  const courtsRaw = text(form, "courts_count");
  const courts = /^\d+$/.test(courtsRaw) ? Number(courtsRaw) : Number.NaN;
  const points = Number(text(form, "points_to"));
  const rotation = text(form, "rotation");
  const matchmaking = text(form, "matchmaking");
  const feeRaw = text(form, "fee");
  const fee = /^\d+$/.test(feeRaw) ? Number(feeRaw) : Number.NaN;
  // A checkbox sends "on" when checked and nothing when not.
  const payFirst = form.get("pay_first") !== null;
  // One Doubles/Singles choice per court; a missing choice means Doubles.
  const courtCount = Number.isInteger(courts) && courts >= COURTS_MIN && courts <= COURTS_MAX ? courts : 0;
  const courtFormats = Array.from({ length: courtCount }, (_, i) => text(form, `court_format_${i + 1}`) || "doubles");

  const errors: Partial<Record<keyof NewSessionInput, string>> = {
    name:
      nameLength === 0
        ? t.session.nameRequired
        : nameLength < SESSION_NAME_MIN
          ? t.session.nameTooShort(SESSION_NAME_MIN)
          : nameLength > SESSION_NAME_MAX
            ? t.session.nameTooLong(SESSION_NAME_MAX)
            : undefined,
    starts_at: startsAt ? undefined : t.session.startsInvalid,
    ends_at: !endsAt
      ? t.session.endsInvalid
      : startsAt && endsAt <= startsAt
        ? t.session.endsBeforeStart
        : undefined,
    courts_count:
      Number.isInteger(courts) && courts >= COURTS_MIN && courts <= COURTS_MAX
        ? undefined
        : t.session.courtsInvalid(COURTS_MIN, COURTS_MAX),
    points_to: (POINTS_OPTIONS as readonly number[]).includes(points) ? undefined : t.club.pointsInvalid,
    rotation: (ROTATION_OPTIONS as readonly string[]).includes(rotation)
      ? undefined
      : t.club.rotationInvalid,
    matchmaking: (MATCHMAKING_OPTIONS as readonly string[]).includes(matchmaking) ? undefined : t.club.matchmakingInvalid,
    fee: Number.isNaN(fee) ? t.club.feeInvalid : fee > FEE_MAX ? t.club.feeTooHigh : undefined,
    court_formats: courtFormats.every((f) => (COURT_FORMATS as readonly string[]).includes(f))
      ? undefined
      : t.session.courtFormatsInvalid,
  };

  return toParseResult(
    {
      name,
      starts_at: startsAt?.toISOString() ?? "",
      ends_at: endsAt?.toISOString() ?? "",
      courts_count: courts,
      points_to: points as Points,
      rotation: rotation as Rotation,
      matchmaking: matchmaking as Matchmaking,
      pay_first: payFirst,
      fee,
      court_formats: courtFormats as CourtFormat[],
    },
    errors,
  );
}
