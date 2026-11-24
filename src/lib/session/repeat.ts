/**
 * "Ulitin ang huling session" (D18): the new-session form, pre-filled from a
 * past or draft session, on the next date its start time hasn't passed yet.
 */
import { parseManilaLocal, toManilaLocal } from "./time";
import type { SessionField } from "./validation";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Same start and end time of day (Manila) as the last session, on today's
 * date if that start time is still ahead, otherwise tomorrow. The length is
 * kept, so a session that ran past midnight still does.
 */
export function repeatTimes(lastStart: Date, lastEnd: Date, now: Date): { startsAt: string; endsAt: string } {
  const startTime = toManilaLocal(lastStart).slice(11, 16);
  const today = toManilaLocal(now).slice(0, 10);
  let start = parseManilaLocal(`${today}T${startTime}`)!;
  // Manila has no daylight saving time, so a day is always 24 hours.
  if (start.getTime() <= now.getTime()) start = new Date(start.getTime() + DAY_MS);
  const length = Math.max(lastEnd.getTime() - lastStart.getTime(), 0);
  return { startsAt: toManilaLocal(start), endsAt: toManilaLocal(new Date(start.getTime() + length)) };
}

export type RepeatableSession = {
  name: string;
  starts_at: string;
  ends_at: string;
  courts_count: number;
  court_formats: string[];
  points_to: number;
  rotation: string;
  pay_first: boolean;
  fee: number;
};

/** Form defaults (the same strings the form posts) for repeating a session. */
export function repeatDefaults(last: RepeatableSession, now: Date): Record<SessionField, string> {
  const times = repeatTimes(new Date(last.starts_at), new Date(last.ends_at), now);
  return {
    name: last.name,
    starts_at: times.startsAt,
    ends_at: times.endsAt,
    courts_count: String(last.courts_count),
    court_formats: last.court_formats.join(","),
    points_to: String(last.points_to),
    rotation: last.rotation,
    pay_first: last.pay_first ? "on" : "",
    fee: String(last.fee),
  };
}
