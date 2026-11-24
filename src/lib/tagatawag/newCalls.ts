/**
 * Which calls are new since the Live screen last looked (D17). A call is a
 * running game with its players, so a swap (swap_not_ready keeps the game but
 * changes a player) is a new call too. The first look only remembers what is
 * already on court: games from before the screen opened are never read aloud.
 */
export type CourtCall = {
  /** game id + player ids */
  key: string;
  courtNumber: number;
  text: string;
};

export function takeNewCalls(seen: Set<string>, calls: readonly CourtCall[]): CourtCall[] {
  const fresh = calls.filter((call) => !seen.has(call.key)).sort((a, b) => a.courtNumber - b.courtNumber);
  for (const call of fresh) seen.add(call.key);
  return fresh;
}
