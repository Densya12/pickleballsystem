/** Home (organizer) and time words. */

const en = {
  pageTitle: "Home",
  greeting: { morning: "Good morning", noon: "Good afternoon", afternoon: "Good afternoon", evening: "Good evening" },
  greetingName: (greeting: string, name?: string | null) => (name ? `${greeting}, ${name}` : greeting),
  live: "LIVE",
  startedAt: (time: string) => `Started ${time}`,
  openSession: (name: string) => `Open ${name}`,
  courtsLabel: "courts",
  queueLabel: "in queue",
  paidLabel: "paid",
  newSession: "New session",
  repeatLast: "Repeat last",
  repeatLastOf: (name: string) => `Repeat last: ${name}`,
  upcoming: "Upcoming",
  past: "Past",
  noUpcoming: "Nothing scheduled. Tap New session to plan one.",
  noPast: "No finished sessions yet.",
  pastLine: (date: string, players: string) => `${date} · ${players}`,
};

const fil: typeof en = {
  pageTitle: "Home",
  greeting: { morning: "Magandang umaga", noon: "Magandang tanghali", afternoon: "Magandang hapon", evening: "Magandang gabi" },
  greetingName: (greeting: string, name?: string | null) => (name ? `${greeting}, ${name}` : greeting),
  live: "LIVE",
  startedAt: (time: string) => `Nagsimula ${time}`,
  openSession: (name: string) => `Buksan ang ${name}`,
  courtsLabel: "courts",
  queueLabel: "nakapila",
  paidLabel: "bayad",
  newSession: "Bagong open play",
  repeatLast: "Ulitin ang huli",
  repeatLastOf: (name: string) => `Ulitin: ${name}`,
  upcoming: "Mga susunod",
  past: "Nakaraan",
  noUpcoming: "Wala pang naka-schedule. Pindutin ang Bagong open play para gumawa.",
  noPast: "Wala pang natapos na session.",
  pastLine: (date: string, players: string) => `${date} · ${players}`,
};

const timeEn = {
  duration: (hours: number, minutes: number) =>
    hours > 0 ? `${hours} h${minutes > 0 ? ` ${minutes} min` : ""}` : `${minutes} min`,
};
const timeFil: typeof timeEn = {
  duration: (hours: number, minutes: number) =>
    hours > 0 ? `${hours} oras${minutes > 0 ? ` ${minutes} minuto` : ""}` : `${minutes} minuto`,
};

export const home = { en, fil };
export const time = { en: timeEn, fil: timeFil };
