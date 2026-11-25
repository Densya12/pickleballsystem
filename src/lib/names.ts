/**
 * QA-07: one rule for display names (players and members), the same as the
 * database's private.clean_display_name / private.display_name_ok. Both are
 * checked against supabase/tests/database/name_cases.inc.
 */

/** Zero-width characters, text-direction controls and the byte-order mark. */
const INVISIBLE = /[​-‏‪-‮⁦-⁩﻿]/g;

export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 40;

/** Removes invisible characters, joins runs of spaces, trims. */
export function cleanDisplayName(raw: string): string {
  return raw.replace(INVISIBLE, "").replace(/\s+/g, " ").trim();
}

/** At least one visible letter or number (any script). */
export function hasLetterOrNumber(name: string): boolean {
  return /[\p{L}\p{N}]/u.test(name);
}

/** A cleaned name is usable: 2-40 characters and a letter or number. */
export function isDisplayNameOk(cleaned: string): boolean {
  const length = [...cleaned].length;
  return length >= DISPLAY_NAME_MIN && length <= DISPLAY_NAME_MAX && hasLetterOrNumber(cleaned);
}
