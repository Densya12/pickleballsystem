/** Shared words, status names (one per state, D19), levels and choices. */

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const en = {
  appName: "Open Play Queue",
  appDescription: "Queue, rotation and payments for pickleball open play.",
  loading: "Loading…",
  back: "Back",
  save: "Save",
  saving: "Saving…",
  saved: "Saved.",
  cancel: "Cancel",
  close: "Close",
  done: "Done",
  retry: "Try again",
  optional: "(optional)",
  copy: "Copy",
  copied: "Copied",
  copyFailed: "Couldn't copy. Press and hold the text to copy it.",
  free: "Free",
  formError: "Some fields need fixing. Check the ones marked in red.",
  genericError: "Something went wrong. Try again.",
  ownerOnly: "Only the club owner can change this.",
  courts: (n: number) => plural(n, "court", "courts"),
  players: (n: number) => plural(n, "player", "players"),
  games: (n: number) => plural(n, "game", "games"),
  minutes: (n: number) => `${n} min`,
  feedback: "Send feedback",
  feedbackLong: "Something wrong or a suggestion? Tell us",
};

const fil: typeof en = {
  appName: "Open Play Queue",
  appDescription: "Pila, rotation at bayad para sa pickleball open play.",
  loading: "Sandali lang…",
  back: "Bumalik",
  save: "I-save",
  saving: "Sine-save…",
  saved: "Na-save na.",
  cancel: "Huwag",
  close: "Isara",
  done: "Tapos na",
  retry: "Subukan ulit",
  optional: "(optional)",
  copy: "Kopyahin",
  copied: "Nakopya na",
  copyFailed: "Hindi makopya. Pindutin nang matagal ang text para kopyahin.",
  free: "Libre",
  formError: "May mali sa form. I-check ang mga naka-pula.",
  genericError: "May problema. Subukan ulit.",
  ownerOnly: "Ang owner lang ang pwedeng magbago nito.",
  courts: (n: number) => plural(n, "court", "courts"),
  players: (n: number) => plural(n, "player", "players"),
  games: (n: number) => plural(n, "laro", "laro"),
  minutes: (n: number) => `${n} min`,
  feedback: "Magpadala ng puna",
  feedbackLong: "May puna o problema? Sabihin sa amin",
};

/** Bottom tab bars (D19). */
const navEn = {
  mainMenu: "Main menu",
  home: "Home",
  members: "Members",
  settings: "Settings",
  session: "Session",
  courts: "Courts",
  queue: "Queue",
  queueCount: (n: number) => `Queue · ${n}`,
  payments: "Payments",
  more: "More",
  needsAction: (n: number) => `${n} to act on`,
};
const navFil: typeof navEn = {
  mainMenu: "Main menu",
  home: "Home",
  members: "Members",
  settings: "Settings",
  session: "Session",
  courts: "Courts",
  queue: "Pila",
  queueCount: (n: number) => `Pila · ${n}`,
  payments: "Bayad",
  more: "Iba pa",
  needsAction: (n: number) => `${n} na aasikasuhin`,
};

/** One word per state, everywhere (D19). */
const statusEn = {
  unpaid: "Unpaid",
  resting: "Resting",
  notReady: "Not ready",
  toCheck: "To check",
  paid: "Paid",
  received: "Received",
  playing: "Playing",
  live: "Live",
  draft: "Draft",
  ended: "Ended",
};
const statusFil: typeof statusEn = {
  unpaid: "Bayad muna",
  resting: "Pahinga",
  notReady: "Hindi pa handa",
  toCheck: "I-check",
  paid: "Bayad na",
  received: "Natanggap",
  playing: "Naglalaro",
  live: "Live",
  draft: "Draft",
  ended: "Tapos na",
};

const levelsEn = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  unsure: "Not sure",
};
const levelsFil: typeof levelsEn = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  unsure: "Hindi sigurado",
};

const choicesEn = {
  doubles: "Doubles",
  singles: "Singles",
  allOff: "All off",
  allOffDescription: "All four go to the back of the queue",
  winnersStay: "Winners stay",
  winnersStayDescription: "Up to 2 games in a row",
  points: (n: number) => `${n} points`,
  duesPaid: "Dues paid",
  duesUnpaid: "Dues unpaid",
  duesNone: "No dues",
};
const choicesFil: typeof choicesEn = {
  doubles: "Doubles",
  singles: "Singles",
  allOff: "Lahat aalis",
  allOffDescription: "Babalik sila sa dulo ng pila",
  winnersStay: "Mananatili ang nanalo",
  winnersStayDescription: "Hanggang 2 sunod na laro lang",
  points: (n: number) => `${n} points`,
  duesPaid: "Bayad ang dues",
  duesUnpaid: "Hindi pa bayad ang dues",
  duesNone: "Walang dues",
};

export const common = { en, fil };
export const nav = { en: navEn, fil: navFil };
export const status = { en: statusEn, fil: statusFil };
export const levels = { en: levelsEn, fil: levelsFil };
export const choices = { en: choicesEn, fil: choicesFil };
