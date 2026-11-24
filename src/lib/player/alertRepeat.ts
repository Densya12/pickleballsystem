/**
 * Phase 6: the "Ikaw na!" chime and vibration repeat every 10 seconds until the
 * player taps "Papunta na ako", for at most 1 minute after the call was first
 * seen on this phone. Leaving and coming back to the screen (or switching
 * between Pwesto and Mga court) keeps the same minute.
 */
export const ALERT_REPEAT_MS = 10_000;
export const ALERT_MAX_MS = 60_000;

/** First time each game's alert started on this page (shared by both screens). */
const startedAtByGame = new Map<string, number>();

export function alertStartedAt(gameId: string, now: number): { startedAt: number; fresh: boolean } {
  const known = startedAtByGame.get(gameId);
  if (known !== undefined) return { startedAt: known, fresh: false };
  startedAtByGame.set(gameId, now);
  return { startedAt: now, fresh: true };
}

/** For tests. */
export function resetAlertHistory(): void {
  startedAtByGame.clear();
}

/**
 * Plays now (when `fresh`), then on every 10-second mark after `startedAt`
 * while less than 1 minute has passed. Returns stop().
 */
export function startRepeatingAlert(
  play: () => void,
  { startedAt, fresh, now = Date.now }: { startedAt: number; fresh: boolean; now?: () => number },
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const scheduleNext = () => {
    const elapsed = now() - startedAt;
    const nextMark = (Math.floor(elapsed / ALERT_REPEAT_MS) + 1) * ALERT_REPEAT_MS;
    if (nextMark >= ALERT_MAX_MS) return;
    timer = setTimeout(() => {
      if (stopped) return;
      play();
      scheduleNext();
    }, nextMark - elapsed);
  };

  if (now() - startedAt < ALERT_MAX_MS) {
    if (fresh) play();
    scheduleNext();
  }
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
