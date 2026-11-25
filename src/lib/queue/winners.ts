import type { Dictionary } from "@/lib/i18n/dictionary";

/**
 * Winner picker (winners stay, BR11): tap the winners — 2 in doubles, 1 in
 * singles. Tapping a picked name un-picks it; tapping one more name than
 * needed replaces the earliest pick, so a mis-tap is fixed with one more tap.
 */
export const WINNERS_NEEDED = 2;

export function winnersFor(format: string): number {
  return format === "singles" ? 1 : 2;
}

export function toggleWinner(picked: readonly string[], id: string, needed = WINNERS_NEEDED): string[] {
  if (picked.includes(id)) return picked.filter((p) => p !== id);
  const next = [...picked, id];
  return next.length > needed ? next.slice(next.length - needed) : next;
}

export function canConfirmWinners(picked: readonly string[], needed = WINNERS_NEEDED): boolean {
  return picked.length === needed;
}

export function winnersHint(picked: readonly string[], needed: number, t: Dictionary): string {
  const left = needed - picked.length;
  return left > 0 ? t.live.pickMore(left) : t.live.readyToConfirm;
}
