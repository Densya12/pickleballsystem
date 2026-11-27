/**
 * "Mga court" (D14, BR21): who is playing on each court and who is next.
 * Eligibility is isCallable() (the mirror of private.eligible_players), never
 * a new rule. Pure functions, shared by the page and its tests.
 */
import { callSizeFor, frontOfLine, isCallable, isHeld, type CallRules, type QueuePlayer } from "./state";

/** How many come after "Maghanda na" ("Susunod pagkatapos"). */
export const AFTER_SHOWN = 2;

export type LineupPlayer = { id: string; name: string };
/**
 * A waiting player in true queue order. place: their place among everyone
 * waiting (queued and paused), the same number the player sees on their phone.
 */
export type LinePlayer = LineupPlayer & {
  place: number;
  /** In the group that will be called next ("Next"). */
  next: boolean;
  /** D25: not in the next group although someone behind them is (or no group fits yet): waiting for a level group. */
  passedOver: boolean;
};
export type WaitingNote = LineupPlayer & { reason: "unpaid" | "resting" };

export type Lineup = {
  /**
   * The front of the line, in queue order: the next 4 (or 2 when every court
   * is singles) eligible players, through the last player of the server's
   * next group (D25). Nobody is moved: players passed over stay in place.
   */
  ready: LinePlayer[];
  /** The eligible players after them (2 by default). */
  after: LinePlayer[];
  /** Waiting but not callable now, in queue order: held for payment or paused. */
  notCallable: WaitingNote[];
};

/**
 * "after" holds the next AFTER_SHOWN eligible players (player view), or all
 * the rest when afterLimit is Infinity (the organizer's Queue screen).
 */
export function courtsLineup(
  players: readonly QueuePlayer[],
  courtFormats: readonly string[],
  rules: CallRules,
  afterLimit = AFTER_SHOWN,
  /**
   * D25: the group the server says is called next (queue_preview), or [] when
   * no group fits the levels. Without it: the next 4 (or 2) eligible.
   */
  predicted?: readonly string[] | null,
): Lineup {
  const waiting = players
    .filter((p) => p.status === "queued" || p.status === "paused")
    .sort((a, b) => a.queuePos - b.queuePos);
  const eligible = waiting.flatMap((p, index) => (isCallable(p, rules) ? [{ id: p.id, name: p.name, place: index + 1 }] : []));
  const front = frontOfLine(
    eligible.map((p) => p.id),
    callSizeFor(courtFormats),
    predicted,
  );
  const line = eligible.map((p) => ({ ...p, next: front.next.has(p.id), passedOver: front.passedOver.has(p.id) }));
  return {
    ready: line.slice(0, front.end),
    after: line.slice(front.end, front.end + afterLimit),
    notCallable: waiting.flatMap((p): WaitingNote[] => {
      if (p.status === "paused") return [{ id: p.id, name: p.name, reason: "resting" }];
      if (isHeld(p, rules)) return [{ id: p.id, name: p.name, reason: "unpaid" }];
      return [];
    }),
  };
}

export type CourtInfo = { id: string; label: string; format: string; /** D26: winners staying (no game yet). */ staying?: string[] };
export type CourtGame = { id: string; number: number; courtId: string; playerIds: string[] };

export type CourtCardData = {
  id: string;
  label: string;
  format: string;
  /** null: "Bakante" */
  game: { number: number; players: LineupPlayer[] } | null;
  /** D26: winners staying on the empty court until the organizer calls. */
  staying: LineupPlayer[];
};

/** One card per court, in court order, with the names now playing (in call order). */
export function courtCards(
  courts: readonly CourtInfo[],
  games: readonly CourtGame[],
  players: readonly QueuePlayer[],
): CourtCardData[] {
  const names = new Map(players.map((p) => [p.id, p.name]));
  return courts.map((court) => {
    const game = games.find((g) => g.courtId === court.id);
    return {
      id: court.id,
      label: court.label,
      format: court.format,
      game: game
        ? { number: game.number, players: game.playerIds.map((id) => ({ id, name: names.get(id) ?? "?" })) }
        : null,
      staying: game ? [] : (court.staying ?? []).map((id) => ({ id, name: names.get(id) ?? "?" })),
    };
  });
}
