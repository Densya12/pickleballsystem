/**
 * Mga member (spec data model: members). Validation shared by the form and its
 * Server Action; the database checks the same rules.
 */
import type { Dictionary } from "@/lib/i18n/dictionary";
import { hasLetterOrNumber } from "@/lib/names";
import { LEVEL_VALUES, PLAYER_NAME_MAX, PLAYER_NAME_MIN, tidyName, type Level } from "@/lib/queue/players";

export const DUES_VALUES = ["paid", "unpaid", "none"] as const;
export type DuesStatus = (typeof DUES_VALUES)[number];

export function duesChoices(t: Dictionary): { value: DuesStatus; label: string }[] {
  return [
    { value: "paid", label: t.choices.duesPaid },
    { value: "unpaid", label: t.choices.duesUnpaid },
    { value: "none", label: t.choices.duesNone },
  ];
}

export function duesLabel(status: string, t: Dictionary): string {
  return duesChoices(t).find((c) => c.value === status)?.label ?? t.choices.duesNone;
}

export const NOTES_MAX = 300;

export type Member = { id: string; name: string; level: string; duesStatus: string; notes: string | null };

export type MemberInput = { display_name: string; level: Level; dues_status: DuesStatus; notes: string | null };
export type MemberField = keyof MemberInput;


type FormLike = { get(name: string): FormDataEntryValue | null };
const text = (form: FormLike, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};

export function parseMember(
  form: FormLike,
  t: Dictionary,
): { ok: true; data: MemberInput } | { ok: false; errors: Partial<Record<MemberField, string>> } {
  const name = tidyName(text(form, "display_name"));
  const length = [...name].length;
  const level = text(form, "level") || "unsure";
  const dues = text(form, "dues_status") || "none";
  const notes = text(form, "notes").trim();

  const errors: Partial<Record<MemberField, string>> = {};
  if (length === 0) errors.display_name = t.members.nameRequired;
  else if (length < PLAYER_NAME_MIN) errors.display_name = t.members.nameTooShort(PLAYER_NAME_MIN);
  else if (length > PLAYER_NAME_MAX) errors.display_name = t.members.nameTooLong(PLAYER_NAME_MAX);
  else if (!hasLetterOrNumber(name)) errors.display_name = t.members.nameNeedsLetter;
  if (!(LEVEL_VALUES as readonly string[]).includes(level)) errors.level = t.members.levelInvalid;
  if (!(DUES_VALUES as readonly string[]).includes(dues)) errors.dues_status = t.members.duesInvalid;
  if ([...notes].length > NOTES_MAX) errors.notes = t.members.notesTooLong(NOTES_MAX);

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: { display_name: name, level: level as Level, dues_status: dues as DuesStatus, notes: notes || null },
  };
}

/** Search by any part of the name, ignoring case and accents ("nino" finds "Niño"). */
export function matchesMember(member: Pick<Member, "name">, query: string): boolean {
  const fold = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const q = fold(query);
  return q === "" || fold(member.name).includes(q);
}

/** Members with the same name as a player (any case), for "I-link sa kanya?". */
export function sameNameMember<M extends Pick<Member, "name">>(members: readonly M[], name: string): M | undefined {
  const target = tidyName(name).toLowerCase();
  return members.find((m) => m.name.toLowerCase() === target);
}
