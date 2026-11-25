import { describe, expect, it } from "vitest";
import { en, fil } from "@/lib/i18n/dictionary";
import { canConfirmWinners, toggleWinner, winnersFor, winnersHint } from "./winners";

describe("winner picker", () => {
  it("picks up to 2", () => {
    expect(toggleWinner([], "a")).toEqual(["a"]);
    expect(toggleWinner(["a"], "b")).toEqual(["a", "b"]);
  });

  it("un-picks a picked name", () => {
    expect(toggleWinner(["a", "b"], "a")).toEqual(["b"]);
  });

  it("a third tap replaces the first pick", () => {
    expect(toggleWinner(["a", "b"], "c")).toEqual(["b", "c"]);
  });

  it("confirms only with exactly 2", () => {
    expect(canConfirmWinners([])).toBe(false);
    expect(canConfirmWinners(["a"])).toBe(false);
    expect(canConfirmWinners(["a", "b"])).toBe(true);
  });

  it("says how many are left", () => {
    expect(winnersHint([], 2, en)).toBe("Pick 2 more.");
    expect(winnersHint(["a"], 2, en)).toBe("Pick 1 more.");
    expect(winnersHint(["a", "b"], 2, en)).toBe("Ready. Tap Confirm.");
    expect(winnersHint([], 2, fil)).toBe("Pumili ng 2 pa.");
  });
});

describe("winner picker for singles (1 winner)", () => {
  it("needs 1 in singles, 2 in doubles", () => {
    expect(winnersFor("singles")).toBe(1);
    expect(winnersFor("doubles")).toBe(2);
  });

  it("a second tap replaces the pick", () => {
    expect(toggleWinner([], "a", 1)).toEqual(["a"]);
    expect(toggleWinner(["a"], "b", 1)).toEqual(["b"]);
    expect(toggleWinner(["a"], "a", 1)).toEqual([]);
  });

  it("confirms with exactly 1", () => {
    expect(canConfirmWinners([], 1)).toBe(false);
    expect(canConfirmWinners(["a"], 1)).toBe(true);
    expect(winnersHint([], 1, en)).toBe("Pick 1 more.");
    expect(winnersHint(["a"], 1, fil)).toBe("Handa na. Pindutin ang Kumpirmahin.");
  });
});
