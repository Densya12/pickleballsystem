import { describe, expect, it } from "vitest";
import { canConfirmWinners, toggleWinner, winnersHint } from "./winners";

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
    expect(winnersHint([])).toBe("Pumili ng 2 pa.");
    expect(winnersHint(["a"])).toBe("Pumili ng 1 pa.");
    expect(winnersHint(["a", "b"])).toBe("Handa na. Pindutin ang Kumpirmahin.");
  });
});
