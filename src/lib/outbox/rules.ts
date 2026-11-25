/**
 * NF10: organizer taps made without signal wait in an outbox and are sent, in
 * order, when the connection returns. Each queued action is safe to send
 * twice: the database refuses a repeat with a known error, which counts as
 * done here; add_walk_in uses a client id instead.
 */

export const QUEUEABLE_KINDS = [
  "call_next",
  "finish_game",
  "add_walk_in",
  "pause_player",
  "resume_player",
  "remove_player",
  "confirm_payment",
  "swap_not_ready",
  "set_court_format",
  "set_rotation",
] as const;
export type OutboxKind = (typeof QUEUEABLE_KINDS)[number];

/** These need the server's answer right away (30-second window; closing check-in). Message: t.live.onlineOnly. */
export const ONLINE_ONLY_KINDS = ["undo_last", "end_session"] as const;

export function isQueueable(kind: string): kind is OutboxKind {
  return (QUEUEABLE_KINDS as readonly string[]).includes(kind);
}

/** Errors that mean "this already happened" when an action is sent again. */
const ALREADY_DONE: Record<OutboxKind, readonly string[]> = {
  call_next: ["court_busy"],
  finish_game: ["game_already_finished"],
  // A resend returns the same player (p_client_id), so it never errors for being a repeat.
  add_walk_in: [],
  pause_player: ["invalid_player_status"],
  resume_player: ["invalid_player_status"],
  remove_player: ["invalid_player_status"],
  confirm_payment: ["already_paid"],
  swap_not_ready: ["player_not_on_court"],
  // Setting the same format again succeeds, so there's nothing to treat as done.
  set_court_format: [],
  // Idempotent too: choosing the current rotation changes nothing (set_session_rotation).
  set_rotation: [],
};

export function isAlreadyDone(kind: OutboxKind, code: string | undefined): boolean {
  return code !== undefined && ALREADY_DONE[kind].includes(code);
}

export type OutboxItem = {
  id: string;
  sessionId: string;
  kind: OutboxKind;
  args: Record<string, string | string[] | null>;
  /** What the organizer did, in the language at the time ("Done: Game #3 on Court 1"). */
  label: string;
  createdAt: number;
};

/** What sending one item returned. A network failure throws instead. */
export type SendResult = { error?: string; code?: string };

export type ReplayOutcome =
  | { status: "done"; sent: number }
  | { status: "offline"; sent: number }
  | { status: "failed"; sent: number; item: OutboxItem; message: string };

/**
 * Sends the items in order. Stops at the first network failure (still
 * offline: keep the rest) or the first real error (the organizer decides).
 * "Already done" errors count as success.
 */
export async function replayOutbox(
  items: readonly OutboxItem[],
  send: (item: OutboxItem) => Promise<SendResult>,
  onSent: (item: OutboxItem) => void,
): Promise<ReplayOutcome> {
  let sent = 0;
  for (const item of items) {
    let result: SendResult;
    try {
      result = await send(item);
    } catch {
      return { status: "offline", sent };
    }
    if (result.error && !isAlreadyDone(item.kind, result.code)) {
      return { status: "failed", sent, item, message: result.error };
    }
    onSent(item);
    sent += 1;
  }
  return { status: "done", sent };
}

/** A failed fetch (no signal, server unreachable), as opposed to an error the server returned. */
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (error instanceof TypeError) return true;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(message);
}
