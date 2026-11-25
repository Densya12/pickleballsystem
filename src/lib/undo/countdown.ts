/**
 * "Ibalik" (D18): the last finish_game, remove_player or confirm_payment can
 * be undone for 30 seconds (undo_last checks the same window on the server).
 * The countdown starts when the organizer tapped, which is before the server
 * recorded the action, so the button never outlives the server's window.
 */
export const UNDO_WINDOW_SECONDS = 30;
export const UNDO_WINDOW_MS = UNDO_WINDOW_SECONDS * 1000;

/** Deadline for an action tapped at `tappedAt` (ms since epoch). */
export function undoDeadline(tappedAt: number): number {
  return tappedAt + UNDO_WINDOW_MS;
}

/** Deadline for an action tapped now. Call it in the tap handler, before awaiting the action. */
export function undoDeadlineFromNow(): number {
  return undoDeadline(Date.now());
}

/** Whole seconds left to show (30 … 1), or 0 once the window has closed. */
export function undoSecondsLeft(deadline: number, now: number): number {
  const left = Math.ceil((deadline - now) / 1000);
  return Math.min(UNDO_WINDOW_SECONDS, Math.max(0, left));
}
