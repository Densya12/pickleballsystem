/**
 * "Mga court" (D14, BR21): who is playing on each court and who is next.
 * Eligibility is isCallable() (the mirror of private.eligible_players), never
 * a new rule. Pure functions, shared by the page and its tests.
 */
import { callSizeFor, isCallable, isHeld, type CallRules, type QueuePlayer } from "./state";

/** How many come after "Maghanda na" ("Susunod pagkatapos"). */
export const AFTER_SHOWN = 2;

export type LineupPlayer = { id: string; name: string };
export type WaitingNote = LineupPlayer & { reason: "bayad muna" | "nagpapahinga" };

export type Lineup = {
  /** The next eligible players for the next empty court: 4, or 2 when every court is singles. */
  ready: LineupPlayer[];
  /** The 2 eligible players after them. */
  after: LineupPlayer[];
  /** Waiting but not callable now, in queue order: held for payment or paused. */
  notCallable: WaitingNote[];
};

export function courtsLineup(players: readonly QueuePlayer[], courtFormats: readonly string[], rules: CallRules): Lineup {
  const waiting = players
    .filter((p) => p.status === "queued" || p.status === "paused")
    .sort((a, b) => a.queuePos - b.queuePos);
  const eligible = waiting.filter((p) => isCallable(p, rules)).map(({ id, name }) => ({ id, name }));
  const size = callSizeFor(courtFormats);
  return {
    ready: eligible.slice(0, size),
    after: eligible.slice(size, size + AFTER_SHOWN),
    notCallable: waiting.flatMap((p): WaitingNote[] => {
      if (p.status === "paused") return [{ id: p.id, name: p.name, reason: "nagpapahinga" }];
      if (isHeld(p, rules)) return [{ id: p.id, name: p.name, reason: "bayad muna" }];
      return [];
    }),
  };
}

export type CourtInfo = { id: string; label: string; format: string };
export type CourtGame = { id: string; number: number; courtId: string; playerIds: string[] };

export type CourtCardData = {
  id: string;
  label: string;
  format: string;
  /** null: "Bakante" */
  game: { number: number; players: LineupPlayer[] } | null;
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
    };
  });
}
