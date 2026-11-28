import type { Dictionary } from "@/lib/i18n/dictionary";
import type { CallMode, Matchmaking, Points, Rotation } from "./validation";

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

/** D25: who plays together, with a one-line hint each (New session, Settings, More). */
export function matchmakingChoices(t: Dictionary): { value: Matchmaking; label: string; description: string; note?: string }[] {
  return [
    { value: "mixed", label: t.choices.mixed, description: t.choices.mixedDescription },
    // D29: levels may be far apart as long as the two teams are about even.
    { value: "balanced", label: t.choices.balanced, description: t.choices.balancedDescription },
    // Same level can leave courts waiting (the simulation): say so where it's picked.
    { value: "same_level", label: t.choices.sameLevel, description: t.choices.sameLevelDescription, note: t.choices.sameLevelNote },
    { value: "fair_line", label: t.choices.fairLine, description: t.choices.fairLineDescription },
  ];
}

export function matchmakingLabel(matchmaking: string, t: Dictionary): string {
  return matchmakingChoices(t).find((choice) => choice.value === matchmaking)?.label ?? matchmaking;
}

/** D26: what Done does next (New session, Settings, More). */
export function callModeChoices(t: Dictionary): { value: CallMode; label: string; description: string }[] {
  return [
    { value: "wait", label: t.choices.waitForMe, description: t.choices.waitForMeDescription },
    { value: "auto_call", label: t.choices.autoCall, description: t.choices.autoCallDescription },
  ];
}

export function callModeLabel(callMode: string, t: Dictionary): string {
  return callModeChoices(t).find((choice) => choice.value === callMode)?.label ?? callMode;
}
