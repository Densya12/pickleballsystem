/**
 * The Bayad screen's numbers. Players who left without paying don't count
 * toward what's expected; everyone else does (including those who left after paying).
 */
export type PaymentStatus = "unpaid" | "pending" | "confirmed";

export type PayingPlayer = {
  id: string;
  name: string;
  /** queued | playing | paused | left */
  status: string;
  paymentStatus: PaymentStatus;
  method: "gcash" | "cash" | null;
  referenceDigits: string | null;
  /** The amount recorded on the payment row (the fee at that time), if any. */
  amount: number | null;
};

export type PaymentSummary = {
  /** Players who owe the fee: not left, or left after paying something. */
  counted: PayingPlayer[];
  confirmed: PayingPlayer[];
  pending: PayingPlayer[];
  unpaid: PayingPlayer[];
  /** ₱ received (confirmed) and ₱ expected (fee x counted). */
  confirmedTotal: number;
  expectedTotal: number;
};

export function summarizePayments(players: readonly PayingPlayer[], fee: number): PaymentSummary {
  const counted = players.filter((p) => p.status !== "left" || p.paymentStatus !== "unpaid");
  const confirmed = counted.filter((p) => p.paymentStatus === "confirmed");
  return {
    counted,
    confirmed,
    pending: counted.filter((p) => p.paymentStatus === "pending"),
    unpaid: counted.filter((p) => p.paymentStatus === "unpaid"),
    confirmedTotal: confirmed.reduce((sum, p) => sum + (p.amount ?? fee), 0),
    expectedTotal: fee * counted.length,
  };
}

/**
 * BR15: references used by more than one player in the session. For each
 * player id, the names of the others with the same reference.
 */
export function duplicateReferences(players: readonly PayingPlayer[]): Map<string, string[]> {
  const byReference = new Map<string, PayingPlayer[]>();
  for (const player of players) {
    if (!player.referenceDigits) continue;
    byReference.set(player.referenceDigits, [...(byReference.get(player.referenceDigits) ?? []), player]);
  }
  const result = new Map<string, string[]>();
  for (const group of byReference.values()) {
    if (group.length < 2) continue;
    for (const player of group) {
      result.set(player.id, group.filter((other) => other.id !== player.id).map((other) => other.name));
    }
  }
  return result;
}
