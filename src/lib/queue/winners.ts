/**
 * Winner picker (winners stay, BR11): tap 2 of the 4 names. Tapping a picked
 * name un-picks it; tapping a third name replaces the first pick, so a
 * mis-tap is fixed with one more tap.
 */
export const WINNERS_NEEDED = 2;

export function toggleWinner(picked: readonly string[], id: string): string[] {
  if (picked.includes(id)) return picked.filter((p) => p !== id);
  const next = [...picked, id];
  return next.length > WINNERS_NEEDED ? next.slice(next.length - WINNERS_NEEDED) : next;
}

export function canConfirmWinners(picked: readonly string[]): boolean {
  return picked.length === WINNERS_NEEDED;
}

export function winnersHint(picked: readonly string[]): string {
  const left = WINNERS_NEEDED - picked.length;
  return left > 0 ? `Pumili ng ${left} pa.` : "Handa na. Pindutin ang Kumpirmahin.";
}
