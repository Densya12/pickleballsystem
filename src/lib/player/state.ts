/**
 * The player's "Pwesto sa pila" screen: which state to show and where they are
 * in the queue. Pure functions, shared by the page and its tests.
 */

export type QueuePlayer = { id: string; name: string; status: string; queuePos: number };
export type RunningGame = { id: string; number: number; courtLabel: string; playerIds: string[] };
export type Me = { id: string; name: string; status: string; notReady: boolean };

/** How many eligible players a court calls at once (BR7). */
export const CALL_SIZE = 4;
export const AHEAD_SHOWN = 3;

/**
 * Who can be called now. Mirrors private.eligible_players in the database
 * (status 'queued'); Phase 5 adds the payment condition in both places.
 */
export function isCallable(player: Pick<QueuePlayer, "status">): boolean {
  return player.status === "queued";
}

export type QueueInfo = {
  /** #N in line among everyone waiting (queued and paused), BR5 order. */
  position: number;
  /** Within the next 4 eligible: "Sa susunod na bakanteng court ka na". */
  nextUp: boolean;
  /** Up to 3 names right before the player, in queue order. */
  ahead: string[];
};

export function queueInfo(players: readonly QueuePlayer[], meId: string): QueueInfo | null {
  const waiting = players
    .filter((p) => p.status === "queued" || p.status === "paused")
    .sort((a, b) => a.queuePos - b.queuePos);
  const index = waiting.findIndex((p) => p.id === meId);
  if (index < 0) return null;

  const before = waiting.slice(0, index);
  const me = waiting[index];
  return {
    position: index + 1,
    nextUp: isCallable(me) && before.filter(isCallable).length < CALL_SIZE,
    ahead: before.slice(-AHEAD_SHOWN).map((p) => p.name),
  };
}

export type PwestoState =
  | { kind: "ended" }
  | { kind: "left" }
  | ({ kind: "queued" } & QueueInfo)
  | { kind: "paused"; position: number }
  | { kind: "playing"; gameId: string; courtLabel: string; withNames: string[]; notReady: boolean };

export function pickPwestoState(input: {
  sessionStatus: string;
  me: Me | null;
  players: readonly QueuePlayer[];
  games: readonly RunningGame[];
}): PwestoState {
  const { sessionStatus, me, players, games } = input;
  if (sessionStatus === "ended") return { kind: "ended" };
  if (!me || me.status === "left") return { kind: "left" };

  if (me.status === "playing") {
    const game = games.find((g) => g.playerIds.includes(me.id));
    if (game) {
      const names = new Map(players.map((p) => [p.id, p.name]));
      return {
        kind: "playing",
        gameId: game.id,
        courtLabel: game.courtLabel,
        // The other 3, in call order. No teams: they pick partners on court (D11).
        withNames: game.playerIds.filter((id) => id !== me.id).map((id) => names.get(id) ?? "?"),
        notReady: me.notReady,
      };
    }
  }

  const info = queueInfo(players, me.id);
  if (me.status === "paused") return { kind: "paused", position: info?.position ?? 0 };
  return { kind: "queued", ...(info ?? { position: 0, nextUp: false, ahead: [] }) };
}
