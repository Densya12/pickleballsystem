/**
 * Match log (D27): finished games, their sides and results, and the team
 * fixes the organizer can make (same players, another pairing). Pure
 * functions shared by the page, the correction sheet and their tests.
 */
import { teamsOf } from "@/lib/queue/winners";

export type LogGame = {
  id: string;
  number: number;
  courtLabel: string;
  format: string;
  /** ISO time the game started. */
  startedAt: string;
  /** Position order: team 1 (left) first. */
  playerIds: string[];
  /** One full side, or null (no result). */
  winnerIds: string[] | null;
};

export type StandingRow = {
  playerId: string;
  name: string;
  wins: number;
  losses: number;
  games: number;
  rank: number;
};

/** Which side won: 0 = left (team 1), 1 = right, null = no result. */
export function winningSide(playerIds: readonly string[], winnerIds: readonly string[] | null, format: string): 0 | 1 | null {
  if (!winnerIds || winnerIds.length === 0) return null;
  const [left, right] = teamsOf(playerIds, format);
  const same = (side: readonly string[]) => side.length === winnerIds.length && side.every((id) => winnerIds.includes(id));
  if (same(left)) return 0;
  if (same(right)) return 1;
  return null;
}

/** The winners for a side choice, in position order (what correct_game expects). */
export function winnersOf(playerIds: readonly string[], side: 0 | 1 | null, format: string): string[] | null {
  return side === null ? null : teamsOf(playerIds, format)[side];
}

/**
 * Doubles "Fix teams": Player 1 keeps the left side with the chosen partner;
 * the other two play right, in their current order. Same 4 players.
 */
export function withPartner(playerIds: readonly string[], partnerId: string): string[] {
  const [first, ...others] = playerIds;
  if (!others.includes(partnerId)) return [...playerIds];
  return [first, partnerId, ...others.filter((id) => id !== partnerId)];
}

/** The 3 possible partners for Player 1 (doubles), current partner first. */
export function partnerChoices(playerIds: readonly string[]): string[] {
  return playerIds.slice(1);
}

/** Newest first (by game number). */
export function newestFirst<T extends { number: number }>(games: readonly T[]): T[] {
  return [...games].sort((a, b) => b.number - a.number);
}
