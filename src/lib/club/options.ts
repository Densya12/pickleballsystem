import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Points, Rotation } from "./validation";

/** Choices shared by club defaults (Settings) and new sessions. */

export const POINTS_CHOICES: readonly { value: `${Points}`; label: string }[] = [
  { value: "11", label: "11" },
  { value: "15", label: "15" },
  { value: "21", label: "21" },
];

export function rotationChoices(t: Dictionary): { value: Rotation; label: string; description: string }[] {
  return [
    { value: "all_off", label: t.choices.allOff, description: t.choices.allOffDescription },
    { value: "winners_stay", label: t.choices.winnersStay, description: t.choices.winnersStayDescription },
  ];
}

export function rotationLabel(rotation: string, t: Dictionary): string {
  return rotationChoices(t).find((choice) => choice.value === rotation)?.label ?? rotation;
}
