/**
 * GCash reference numbers (BR15): typed with spaces or dashes, stored as
 * digits only, 6-20 digits. Mirrors private.normalize_reference.
 */
export const REFERENCE_MIN = 6;
export const REFERENCE_MAX = 20;

/** "1234 5678-90" -> "1234567890"; null when it isn't 6-20 digits after that. */
export function normalizeReference(raw: string): string | null {
  const digits = raw.replace(/[\s-]/g, "");
  return /^\d{6,20}$/.test(digits) ? digits : null;
}

/** "•••• 7890": the last 4 digits only, for the Bayad list. */
export function maskReference(digits: string): string {
  return `•••• ${digits.slice(-4)}`;
}

export const REFERENCE_MESSAGES = {
  invalid: `Mukhang mali ang reference number. ${REFERENCE_MIN} hanggang ${REFERENCE_MAX} na numero.`,
  hint: "Okay lang kahit may space o gitling.",
} as const;
