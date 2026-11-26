/**
 * D25: what the server says about the next call (public.queue_preview) and
 * why each game was called (games.call_note). Presentation only: the client
 * never picks groups itself.
 */
import type { Dictionary } from "@/lib/i18n/dictionary";

export type PreviewPlayer = { id: string; name: string; skill: number | null };
export type FormatPreview = {
  status: "ok" | "no_group" | "not_enough";
  group: PreviewPlayer[];
  lo?: number;
  hi?: number;
  repeats?: number;
  missing?: number;
};
export type QueuePreview = { preset: string; formats: Partial<Record<string, FormatPreview>> };

/** The note stored on a game when it was called. */
export type CallNote = { preset?: string; lo?: number; hi?: number; repeats?: number; mixed_call?: boolean; stayed?: boolean };

export function parsePreview(raw: unknown): QueuePreview | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as QueuePreview;
  return typeof value.preset === "string" ? { preset: value.preset, formats: value.formats ?? {} } : null;
}

/** The preview for the next court: doubles when any court is doubles, else singles. */
export function nextPreview(preview: QueuePreview | null, courtFormats: readonly string[]): FormatPreview | null {
  if (!preview) return null;
  const format = courtFormats.includes("doubles") || courtFormats.length === 0 ? "doubles" : "singles";
  return preview.formats[format] ?? null;
}

/** "levels 2–4", "level 3", or null when nobody has a level. */
export function bandText(t: Dictionary, lo: number | null | undefined, hi: number | null | undefined): string | null {
  return typeof lo === "number" && typeof hi === "number" ? t.levels.band(lo, hi) : null;
}

/**
 * Why a call happened, for the banners: " · levels 2–4 · haven't played
 * together". Empty for Fair line (unchanged banners) and old games.
 */
export function explainCall(t: Dictionary, note: CallNote | null | undefined): string {
  if (!note || !note.preset || note.preset === "fair_line") return "";
  const parts: string[] = [];
  if (note.mixed_call) parts.push(t.live.mixedCallNote);
  const band = bandText(t, note.lo, note.hi);
  if (band) parts.push(band);
  if (!note.mixed_call && typeof note.repeats === "number") parts.push(note.repeats === 0 ? t.live.freshGroup : t.live.someRepeat);
  return parts.length > 0 ? ` · ${parts.join(" · ")}` : "";
}

/** The levels a player can be grouped with: Mixed +-1, Same level equal; null for Fair line or no level. */
export function playerBand(preset: string, skill: number | null | undefined): [number, number] | null {
  if (typeof skill !== "number" || preset === "fair_line") return null;
  if (preset === "same_level") return [skill, skill];
  return [Math.max(1, skill - 1), Math.min(5, skill + 1)];
}

/** "No level 2–4 group yet" (or without a range when nobody has a level). */
export function noGroupText(t: Dictionary, preview: FormatPreview): string {
  return typeof preview.lo === "number" && typeof preview.hi === "number"
    ? t.live.noLevelGroupShort(t.levels.groupBand(preview.lo, preview.hi))
    : t.live.noGroupShort;
}

/** The ids the server will call next, [] when no group fits, or null when unknown. */
export function predictedIds(preview: QueuePreview | null, courtFormats: readonly string[]): string[] | null {
  const next = nextPreview(preview, courtFormats);
  if (!next) return null;
  return next.status === "ok" ? next.group.map((p) => p.id) : [];
}
