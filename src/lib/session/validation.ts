/**
 * New-session input (BR2), shared by the form and its Server Action. The
 * database checks the same rules; this layer gives a Taglish message per field.
 */
import {
  FEE_MAX,
  MESSAGES as CLUB_MESSAGES,
  POINTS_OPTIONS,
  ROTATION_OPTIONS,
  toParseResult,
  type ParseResult,
  type Points,
  type Rotation,
} from "@/lib/club/validation";
import { parseManilaLocal } from "./time";

export const SESSION_NAME_MIN = 2;
export const SESSION_NAME_MAX = 60;
export const COURTS_MIN = 1;
export const COURTS_MAX = 8;
export const COURTS_DEFAULT = 2;

export const SESSION_MESSAGES = {
  nameRequired: "Pakilagay ang pangalan ng session.",
  nameTooShort: `Masyadong maikli. Kahit ${SESSION_NAME_MIN} letra.`,
  nameTooLong: `Hanggang ${SESSION_NAME_MAX} letra lang.`,
  startsInvalid: "Pakilagay ang petsa at oras ng simula.",
  endsInvalid: "Pakilagay ang petsa at oras ng tapos.",
  endsBeforeStart: "Dapat mas huli ang Tapos kaysa sa Simula.",
  courtsInvalid: `Pumili ng ${COURTS_MIN} hanggang ${COURTS_MAX} court.`,
  pointsInvalid: CLUB_MESSAGES.pointsInvalid,
  rotationInvalid: "Pumili kung ano ang mangyayari pagkatapos ng laro.",
  feeInvalid: CLUB_MESSAGES.feeInvalid,
  feeTooHigh: CLUB_MESSAGES.feeTooHigh,
} as const;

/** Form field names (also the keys for field errors and kept values). */
export const SESSION_FIELDS = [
  "name",
  "starts_at",
  "ends_at",
  "courts_count",
  "points_to",
  "rotation",
  "pay_first",
  "fee",
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
  pay_first: boolean;
  fee: number;
};

type FormLike = { get(name: string): FormDataEntryValue | null };

function text(form: FormLike, field: string): string {
  const value = form.get(field);
  return typeof value === "string" ? value.trim() : "";
}

export function parseNewSession(form: FormLike): ParseResult<NewSessionInput> {
  const name = text(form, "name");
  const nameLength = [...name].length;
  const startsAt = parseManilaLocal(text(form, "starts_at"));
  const endsAt = parseManilaLocal(text(form, "ends_at"));
  const courtsRaw = text(form, "courts_count");
  const courts = /^\d+$/.test(courtsRaw) ? Number(courtsRaw) : Number.NaN;
  const points = Number(text(form, "points_to"));
  const rotation = text(form, "rotation");
  const feeRaw = text(form, "fee");
  const fee = /^\d+$/.test(feeRaw) ? Number(feeRaw) : Number.NaN;
  // A checkbox sends "on" when checked and nothing when not.
  const payFirst = form.get("pay_first") !== null;

  const errors: Partial<Record<keyof NewSessionInput, string>> = {
    name:
      nameLength === 0
        ? SESSION_MESSAGES.nameRequired
        : nameLength < SESSION_NAME_MIN
          ? SESSION_MESSAGES.nameTooShort
          : nameLength > SESSION_NAME_MAX
            ? SESSION_MESSAGES.nameTooLong
            : undefined,
    starts_at: startsAt ? undefined : SESSION_MESSAGES.startsInvalid,
    ends_at: !endsAt
      ? SESSION_MESSAGES.endsInvalid
      : startsAt && endsAt <= startsAt
        ? SESSION_MESSAGES.endsBeforeStart
        : undefined,
    courts_count:
      Number.isInteger(courts) && courts >= COURTS_MIN && courts <= COURTS_MAX
        ? undefined
        : SESSION_MESSAGES.courtsInvalid,
    points_to: (POINTS_OPTIONS as readonly number[]).includes(points) ? undefined : SESSION_MESSAGES.pointsInvalid,
    rotation: (ROTATION_OPTIONS as readonly string[]).includes(rotation)
      ? undefined
      : SESSION_MESSAGES.rotationInvalid,
    fee: Number.isNaN(fee) ? SESSION_MESSAGES.feeInvalid : fee > FEE_MAX ? SESSION_MESSAGES.feeTooHigh : undefined,
  };

  return toParseResult(
    {
      name,
      starts_at: startsAt?.toISOString() ?? "",
      ends_at: endsAt?.toISOString() ?? "",
      courts_count: courts,
      points_to: points as Points,
      rotation: rotation as Rotation,
      pay_first: payFirst,
      fee,
    },
    errors,
  );
}
