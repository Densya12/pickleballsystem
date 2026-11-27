/**
 * Teams and winners (D25, amends D11): a game's players are two teams in
 * position order. Doubles: positions 1-2 (left) vs 3-4 (right); singles:
 * 1 vs 2. The organizer taps the side that won.
 */

export function winnersFor(format: string): number {
  return format === "singles" ? 1 : 2;
}

/** [left team, right team], in position order. */
export function teamsOf<T>(players: readonly T[], format: string): [T[], T[]] {
  const half = format === "singles" ? 1 : 2;
  return [players.slice(0, half), players.slice(half, half * 2)];
}

/** Which side a position is on: 0 = left (team 1), 1 = right (team 2). */
export function sideOf(index: number, format: string): 0 | 1 {
  return index < (format === "singles" ? 1 : 2) ? 0 : 1;
}

/** The player's partner (doubles), or null. */
export function partnerOf<T extends { id: string }>(players: readonly T[], meId: string, format: string): T | null {
  if (format === "singles") return null;
  const index = players.findIndex((p) => p.id === meId);
  if (index < 0) return null;
  const partnerIndex = index < 2 ? 1 - index : 5 - index;
  return players[partnerIndex] ?? null;
}
