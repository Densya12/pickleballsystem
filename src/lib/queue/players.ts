/**
 * Player input for the queue (walk-ins, BR20). The database checks the same
 * rules; this layer gives a Taglish message per field.
 */
import { toParseResult, type ParseResult } from "@/lib/club/validation";

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
