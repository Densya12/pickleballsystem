import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { alertStartedAt, resetAlertHistory, startRepeatingAlert } from "./alertRepeat";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-24T10:00:00Z"));
  resetAlertHistory();
});
afterEach(() => vi.useRealTimers());

describe("repeating called alert", () => {
  it("plays at once, then every 10 seconds, and stops after 1 minute", () => {
    const play = vi.fn();
    startRepeatingAlert(play, { startedAt: Date.now(), fresh: true });
    expect(play).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(9_999);
    expect(play).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(play).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(40_000); // 50 s
    expect(play).toHaveBeenCalledTimes(6);
    vi.advanceTimersByTime(60_000);
    expect(play).toHaveBeenCalledTimes(6);
  });

  it("stops when the player taps Papunta na ako", () => {
    const play = vi.fn();
    const stop = startRepeatingAlert(play, { startedAt: Date.now(), fresh: true });
    vi.advanceTimersByTime(10_000);
    expect(play).toHaveBeenCalledTimes(2);
    stop();
    vi.advanceTimersByTime(60_000);
    expect(play).toHaveBeenCalledTimes(2);
  });

  it("keeps the same minute when the screen is opened again mid-way", () => {
    const play = vi.fn();
    const first = alertStartedAt("game-1", Date.now());
    expect(first.fresh).toBe(true);
    const stop = startRepeatingAlert(play, first);
    vi.advanceTimersByTime(25_000);
    stop();
    expect(play).toHaveBeenCalledTimes(3); // 0, 10, 20

    const again = alertStartedAt("game-1", Date.now());
    expect(again).toEqual({ startedAt: first.startedAt, fresh: false });
    startRepeatingAlert(play, again);
    expect(play).toHaveBeenCalledTimes(3); // not replayed at 25 s
    vi.advanceTimersByTime(5_000);
    expect(play).toHaveBeenCalledTimes(4); // 30 s
    vi.advanceTimersByTime(60_000);
    expect(play).toHaveBeenCalledTimes(6); // 40, 50; nothing at 60
  });

  it("does nothing once the minute is over", () => {
    const play = vi.fn();
    startRepeatingAlert(play, { startedAt: Date.now() - 61_000, fresh: true });
    vi.advanceTimersByTime(60_000);
    expect(play).not.toHaveBeenCalled();
  });

  it("each game has its own minute", () => {
    expect(alertStartedAt("a", 1).fresh).toBe(true);
    expect(alertStartedAt("b", 2).fresh).toBe(true);
    expect(alertStartedAt("a", 3)).toEqual({ startedAt: 1, fresh: false });
  });
});
