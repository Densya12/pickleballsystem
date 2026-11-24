/**
 * Times are stored as timestamptz and always shown in Asia/Manila, whatever
 * the device's own time zone is. The Philippines has no daylight saving time,
 * so Manila is a fixed UTC+08:00.
 */

export const MANILA_TIME_ZONE = "Asia/Manila";
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Date → "YYYY-MM-DDTHH:mm" on the Manila wall clock (the datetime-local format). */
export function toManilaLocal(date: Date): string {
  return new Date(date.getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 16);
}

/**
 * "YYYY-MM-DDTHH:mm" read as Manila time → Date. Returns null for anything
 * else, including dates that don't exist (e.g. Feb 30).
 */
export function parseManilaLocal(value: string): Date | null {
  const trimmed = value.trim();
  if (!LOCAL_PATTERN.test(trimmed)) return null;
  const date = new Date(`${trimmed}:00+08:00`);
  if (Number.isNaN(date.getTime())) return null;
  // JavaScript rolls impossible dates over (Feb 30 → Mar 2); refuse those.
  return toManilaLocal(date) === trimmed ? date : null;
}

/** New-session form defaults: the next full hour, for 3 hours. */
export function defaultSessionTimes(now: Date): { startsAt: string; endsAt: string } {
  const start = new Date(Math.ceil(now.getTime() / HOUR_MS) * HOUR_MS);
  const end = new Date(start.getTime() + 3 * HOUR_MS);
  return { startsAt: toManilaLocal(start), endsAt: toManilaLocal(end) };
}

function format(date: Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("fil-PH", { timeZone: MANILA_TIME_ZONE, ...options }).format(date);
}

/** "Martes, Nob 24" */
export function formatDay(date: Date): string {
  return format(date, { weekday: "long", month: "short", day: "numeric" });
}

/** "Nob 24, 2026" */
export function formatDate(date: Date): string {
  return format(date, { month: "short", day: "numeric", year: "numeric" });
}

/** "6:00 PM" */
export function formatTime(date: Date): string {
  return format(date, { hour: "numeric", minute: "2-digit" });
}

function sameManilaDay(a: Date, b: Date): boolean {
  return toManilaLocal(a).slice(0, 10) === toManilaLocal(b).slice(0, 10);
}

/** "6:00 PM – 9:00 PM", or "10:00 PM – Nob 25, 1:00 AM" past midnight. */
export function formatTimeRange(start: Date, end: Date): string {
  const endText = sameManilaDay(start, end)
    ? formatTime(end)
    : `${format(end, { month: "short", day: "numeric" })}, ${formatTime(end)}`;
  return `${formatTime(start)} – ${endText}`;
}

/** "Martes, Nob 24 · 6:00 PM – 9:00 PM" */
export function formatSchedule(start: Date, end: Date): string {
  return `${formatDay(start)} · ${formatTimeRange(start, end)}`;
}

/** { month: "NOB", day: "24" } for the date badge. */
export function dateBadge(date: Date): { month: string; day: string } {
  return {
    month: format(date, { month: "short" }).toUpperCase(),
    day: format(date, { day: "numeric" }),
  };
}

/** Greeting for the time of day in Manila. */
export function greeting(now: Date): string {
  const hour = Number(toManilaLocal(now).slice(11, 13));
  if (hour >= 5 && hour < 12) return "Magandang umaga";
  if (hour >= 12 && hour < 13) return "Magandang tanghali";
  if (hour >= 13 && hour < 18) return "Magandang hapon";
  return "Magandang gabi";
}
