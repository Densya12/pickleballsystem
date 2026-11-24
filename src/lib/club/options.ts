import type { Points, Rotation } from "./validation";

/** Choices shared by club defaults (Settings) and new sessions. */

export const POINTS_CHOICES: readonly { value: `${Points}`; label: string }[] = [
  { value: "11", label: "11" },
  { value: "15", label: "15" },
  { value: "21", label: "21" },
];

export const ROTATION_CHOICES: readonly { value: Rotation; label: string; description: string }[] = [
  { value: "all_off", label: "Lahat aalis", description: "Babalik sila sa dulo ng pila" },
  { value: "winners_stay", label: "Mananatili ang nanalo", description: "Hanggang 2 sunod na laro lang" },
];

export function rotationLabel(rotation: string): string {
  return ROTATION_CHOICES.find((choice) => choice.value === rotation)?.label ?? rotation;
}
