/**
 * Mga member (spec data model: members). Validation shared by the form and its
 * Server Action; the database checks the same rules.
 */
import { LEVELS, PLAYER_NAME_MAX, PLAYER_NAME_MIN, tidyName, type Level } from "@/lib/queue/players";

export const DUES_CHOICES = [
  { value: "paid", label: "Bayad ang dues" },
  { value: "unpaid", label: "Hindi pa bayad ang dues" },
  { value: "none", label: "Walang dues" },
] as const;
export type DuesStatus = (typeof DUES_CHOICES)[number]["value"];

export function duesLabel(status: string): string {
  return DUES_CHOICES.find((c) => c.value === status)?.label ?? "Walang dues";
}

export const NOTES_MAX = 300;

export type Member = { id: string; name: string; level: string; duesStatus: string; notes: string | null };

export type MemberInput = { display_name: string; level: Level; dues_status: DuesStatus; notes: string | null };
export type MemberField = keyof MemberInput;

export const MEMBER_MESSAGES = {
  nameRequired: "Pakilagay ang pangalan.",
  nameTooShort: `Masyadong maikli. Kahit ${PLAYER_NAME_MIN} letra.`,
  nameTooLong: `Hanggang ${PLAYER_NAME_MAX} letra lang.`,
  levelInvalid: "Pumili ng level.",
  duesInvalid: "Pumili kung bayad ang dues.",
  notesTooLong: `Hanggang ${NOTES_MAX} letra lang ang notes.`,
} as const;

type FormLike = { get(name: string): FormDataEntryValue | null };
const text = (form: FormLike, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};

export function parseMember(
  form: FormLike,
): { ok: true; data: MemberInput } | { ok: false; errors: Partial<Record<MemberField, string>> } {
  const name = tidyName(text(form, "display_name"));
  const length = [...name].length;
  const level = text(form, "level") || "unsure";
  const dues = text(form, "dues_status") || "none";
  const notes = text(form, "notes").trim();

  const errors: Partial<Record<MemberField, string>> = {};
  if (length === 0) errors.display_name = MEMBER_MESSAGES.nameRequired;
  else if (length < PLAYER_NAME_MIN) errors.display_name = MEMBER_MESSAGES.nameTooShort;
  else if (length > PLAYER_NAME_MAX) errors.display_name = MEMBER_MESSAGES.nameTooLong;
  if (!LEVELS.some((l) => l.value === level)) errors.level = MEMBER_MESSAGES.levelInvalid;
  if (!DUES_CHOICES.some((d) => d.value === dues)) errors.dues_status = MEMBER_MESSAGES.duesInvalid;
  if ([...notes].length > NOTES_MAX) errors.notes = MEMBER_MESSAGES.notesTooLong;

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
