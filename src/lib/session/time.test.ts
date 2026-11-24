import { describe, expect, it } from "vitest";
import {
  dateBadge,
  defaultSessionTimes,
  formatDate,
  formatDay,
  formatSchedule,
  formatTimeRange,
  greeting,
  parseManilaLocal,
  toManilaLocal,
} from "./time";

describe("Manila wall-clock conversion", () => {
  it("reads datetime-local values as Manila time (UTC+8)", () => {
    expect(parseManilaLocal("2026-11-27T18:00")?.toISOString()).toBe("2026-11-27T10:00:00.000Z");
    expect(parseManilaLocal("2026-11-28T01:30")?.toISOString()).toBe("2026-11-27T17:30:00.000Z");
  });

  it("writes dates back in the same format", () => {
    expect(toManilaLocal(new Date("2026-11-27T10:00:00Z"))).toBe("2026-11-27T18:00");
    expect(toManilaLocal(new Date("2026-12-31T16:59:00Z"))).toBe("2027-01-01T00:59");
  });

  it.each(["", "2026-11-27", "18:00", "2026-11-27 18:00", "2026-02-30T10:00", "2026-11-27T24:00", "abc"])(
    "refuses %j",
    (value) => expect(parseManilaLocal(value)).toBeNull(),
  );
});

describe("defaultSessionTimes", () => {
  it("starts at the next full hour in Manila and lasts 3 hours", () => {
    // 14:23 in Manila
    expect(defaultSessionTimes(new Date("2026-11-24T06:23:00Z"))).toEqual({
      startsAt: "2026-11-24T15:00",
      endsAt: "2026-11-24T18:00",
    });
  });

  it("keeps an exact hour", () => {
    expect(defaultSessionTimes(new Date("2026-11-24T10:00:00Z")).startsAt).toBe("2026-11-24T18:00");
  });

  it("rolls over midnight", () => {
    expect(defaultSessionTimes(new Date("2026-11-24T15:10:00Z"))).toEqual({
      startsAt: "2026-11-25T00:00",
      endsAt: "2026-11-25T03:00",
    });
  });
});

describe("formatting (always Asia/Manila)", () => {
  const start = new Date("2026-11-24T10:00:00Z"); // Tue 6:00 PM Manila
  const end = new Date("2026-11-24T13:00:00Z"); // 9:00 PM

  it("formats the day and date in Filipino", () => {
    expect(formatDay(start)).toBe("Martes, Nob 24");
    expect(formatDate(start)).toBe("Nob 24, 2026");
  });

  it("formats a same-day time range", () => {
    expect(formatTimeRange(start, end)).toBe("6:00 PM – 9:00 PM");
    expect(formatSchedule(start, end)).toBe("Martes, Nob 24 · 6:00 PM – 9:00 PM");
  });

  it("names the end date when a session runs past midnight", () => {
    expect(formatTimeRange(new Date("2026-11-24T14:00:00Z"), new Date("2026-11-24T17:00:00Z"))).toBe(
      "10:00 PM – Nob 25, 1:00 AM",
    );
  });

  it("uses Manila's date even when UTC is still the day before", () => {
    // 2026-11-24 23:30 UTC = Nov 25, 7:30 AM in Manila
    expect(dateBadge(new Date("2026-11-24T23:30:00Z"))).toEqual({ month: "NOB", day: "25" });
  });
});

describe("greeting", () => {
  const at = (manilaHour: number) => new Date(Date.UTC(2026, 10, 24, manilaHour - 8 < 0 ? manilaHour + 16 : manilaHour - 8));
  it.each([
    [6, "Magandang umaga"],
    [11, "Magandang umaga"],
    [12, "Magandang tanghali"],
    [15, "Magandang hapon"],
    [19, "Magandang gabi"],
    [2, "Magandang gabi"],
  ])("%i:00 in Manila → %s", (hour, expected) => expect(greeting(at(hour))).toBe(expected));
});
