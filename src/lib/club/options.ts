import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Points, Rotation } from "./validation";

/** Choices shared by club defaults (Settings) and new sessions. */

export const POINTS_CHOICES: readonly { value: `${Points}`; label: string }[] = [
  { value: "11", label: "11" },
  { value: "15", label: "15" },
  { value: "21", label: "21" },
];

/**
 * QA-13: "All off" describes who leaves the court. All doubles: "All four";
 * all singles: "Both"; mixed or unknown (club defaults): "Everyone on court".
 */
export function allOffDescription(t: Dictionary, formats?: readonly string[]): string {
  const kinds = new Set(formats ?? []);
  if (kinds.size === 1 && kinds.has("doubles")) return t.choices.allOffDescription;
  if (kinds.size === 1 && kinds.has("singles")) return t.choices.allOffDescriptionSingles;
  return t.choices.allOffDescriptionMixed;
}

/** `formats`: the session's court formats, when known. */
export function rotationChoices(
  t: Dictionary,
  formats?: readonly string[],
): { value: Rotation; label: string; description: string }[] {
  return [
    { value: "all_off", label: t.choices.allOff, description: allOffDescription(t, formats) },
    { value: "winners_stay", label: t.choices.winnersStay, description: t.choices.winnersStayDescription },
  ];
}

export function rotationLabel(rotation: string, t: Dictionary): string {
  return rotationChoices(t).find((choice) => choice.value === rotation)?.label ?? rotation;
}
