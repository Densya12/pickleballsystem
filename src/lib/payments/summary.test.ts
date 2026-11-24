import { describe, expect, it } from "vitest";
import { duplicateReferences, summarizePayments, type PayingPlayer } from "./summary";

const p = (id: string, status: string, paymentStatus: PayingPlayer["paymentStatus"], extra: Partial<PayingPlayer> = {}): PayingPlayer => ({
  id,
  name: id.toUpperCase(),
  status,
  paymentStatus,
  method: null,
  referenceDigits: null,
  amount: paymentStatus === "unpaid" ? null : 150,
  ...extra,
});

describe("summarizePayments", () => {
  const players = [
    p("a", "queued", "confirmed", { method: "cash" }),
    p("b", "playing", "pending", { method: "gcash", referenceDigits: "111111" }),
    p("c", "queued", "unpaid"),
    p("d", "left", "unpaid"), // left without paying: not expected
    p("e", "left", "confirmed", { method: "gcash" }), // left after paying: counts
    p("f", "paused", "unpaid", { method: "cash" }),
  ];

  it("counts bayad, i-check and hindi pa", () => {
    const s = summarizePayments(players, 150);
    expect(s.confirmed.map((x) => x.id)).toEqual(["a", "e"]);
    expect(s.pending.map((x) => x.id)).toEqual(["b"]);
    expect(s.unpaid.map((x) => x.id)).toEqual(["c", "f"]);
  });

  it("players who left without paying don't count toward expected", () => {
    const s = summarizePayments(players, 150);
    expect(s.counted).toHaveLength(5);
    expect(s.expectedTotal).toBe(750);
  });

  it("totals what was confirmed, using each payment's recorded amount", () => {
    expect(summarizePayments(players, 150).confirmedTotal).toBe(300);
    expect(summarizePayments([p("x", "queued", "confirmed", { amount: 120 })], 150).confirmedTotal).toBe(120);
  });

  it("is all zeros with nobody", () => {
    expect(summarizePayments([], 150)).toMatchObject({ confirmedTotal: 0, expectedTotal: 0 });
  });
});

describe("duplicateReferences (BR15: flagged, not rejected)", () => {
  it("names the other players with the same reference", () => {
    const dupes = duplicateReferences([
      p("a", "queued", "pending", { referenceDigits: "123456" }),
      p("b", "queued", "pending", { referenceDigits: "123456" }),
      p("c", "queued", "confirmed", { referenceDigits: "123456" }),
      p("d", "queued", "pending", { referenceDigits: "999999" }),
      p("e", "queued", "unpaid"),
    ]);
    expect(dupes.get("a")).toEqual(["B", "C"]);
    expect(dupes.get("b")).toEqual(["A", "C"]);
    expect(dupes.has("d")).toBe(false);
    expect(dupes.has("e")).toBe(false);
  });
});

describe("summarizePayments after the session ended", () => {
  const ended = (name: string, paymentStatus: "unpaid" | "pending" | "confirmed", gamesPlayed: number) => ({
    id: name, name, status: "left", paymentStatus, method: null, referenceDigits: null, amount: null, gamesPlayed,
  });

  it("counts whoever played or paid (everyone is 'left' now)", () => {
    const summary = summarizePayments(
      [ended("Ana", "unpaid", 3), ended("Ben", "confirmed", 0), ended("Cara", "unpaid", 0), ended("Dino", "pending", 2)],
      150,
      { sessionEnded: true },
    );
    expect(summary.counted.map((p) => p.name)).toEqual(["Ana", "Ben", "Dino"]);
    expect(summary.unpaid.map((p) => p.name)).toEqual(["Ana"]);
    expect(summary.expectedTotal).toBe(450);
  });
});

