import { describe, expect, it } from "vitest";
import { undoDeadline, undoSecondsLeft, UNDO_WINDOW_MS } from "./countdown";

describe("undo countdown", () => {
  const tapped = 1_000_000;
  const deadline = undoDeadline(tapped);

  it("lasts 30 seconds from the tap", () => {
    expect(deadline - tapped).toBe(UNDO_WINDOW_MS);
    expect(undoSecondsLeft(deadline, tapped)).toBe(30);
  });

  it("counts down in whole seconds, rounding up", () => {
    expect(undoSecondsLeft(deadline, tapped + 1)).toBe(30);
    expect(undoSecondsLeft(deadline, tapped + 1_000)).toBe(29);
    expect(undoSecondsLeft(deadline, tapped + 20_500)).toBe(10);
    expect(undoSecondsLeft(deadline, tapped + 29_999)).toBe(1);
  });

  it("is 0 at and after the deadline", () => {
    expect(undoSecondsLeft(deadline, deadline)).toBe(0);
    expect(undoSecondsLeft(deadline, deadline + 60_000)).toBe(0);
  });

  it("never shows more than 30 (e.g. a clock that moved back)", () => {
    expect(undoSecondsLeft(deadline, tapped - 5_000)).toBe(30);
  });
});
