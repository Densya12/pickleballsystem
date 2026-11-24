import { describe, expect, it } from "vitest";
import { parseNewSession, SESSION_MESSAGES } from "./validation";

function form(overrides: Record<string, string | null> = {}) {
  const values: Record<string, string | null> = {
    name: "Friday Night Open Play",
    starts_at: "2026-11-27T18:00",
    ends_at: "2026-11-27T21:00",
    courts_count: "3",
    points_to: "11",
    rotation: "all_off",
    pay_first: null,
    fee: "150",
    ...overrides,
  };
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) if (value !== null) data.set(key, value);
  return data;
}

function errorsOf(overrides: Record<string, string | null>) {
  const result = parseNewSession(form(overrides));
  if (result.ok) throw new Error("expected errors");
  return result.errors;
}

describe("parseNewSession", () => {
  it("accepts a valid form and converts Manila times to UTC", () => {
    expect(parseNewSession(form())).toEqual({
      ok: true,
      data: {
        name: "Friday Night Open Play",
        starts_at: "2026-11-27T10:00:00.000Z",
        ends_at: "2026-11-27T13:00:00.000Z",
        courts_count: 3,
        points_to: 11,
        rotation: "all_off",
        pay_first: false,
        fee: 150,
        court_formats: ["doubles", "doubles", "doubles"],
      },
    });
  });

  it("reads one Doubles/Singles choice per court (missing = Doubles)", () => {
    const result = parseNewSession(form({ courts_count: "3", court_format_1: "doubles", court_format_2: "singles" }));
    expect(result.ok && result.data.court_formats).toEqual(["doubles", "singles", "doubles"]);
  });

  it("ignores choices for courts beyond the count", () => {
    const result = parseNewSession(form({ courts_count: "1", court_format_1: "singles", court_format_2: "singles" }));
    expect(result.ok && result.data.court_formats).toEqual(["singles"]);
  });

  it("refuses an unknown format", () => {
    expect(errorsOf({ courts_count: "2", court_format_2: "triples" })).toEqual({ court_formats: SESSION_MESSAGES.courtFormatsInvalid });
  });

  it("reads the pay-first switch (checked sends 'on')", () => {
    const result = parseNewSession(form({ pay_first: "on" }));
    expect(result.ok && result.data.pay_first).toBe(true);
  });

  it("trims the name and allows a session that ends after midnight", () => {
    const result = parseNewSession(form({ name: "  Late Night  ", starts_at: "2026-11-27T22:00", ends_at: "2026-11-28T01:00" }));
    expect(result.ok && result.data.name).toBe("Late Night");
    expect(result.ok && result.data.ends_at).toBe("2026-11-27T17:00:00.000Z");
  });

  it.each([
    [{ name: "" }, "name", SESSION_MESSAGES.nameRequired],
    [{ name: "   " }, "name", SESSION_MESSAGES.nameRequired],
    [{ name: "X" }, "name", SESSION_MESSAGES.nameTooShort],
    [{ name: "n".repeat(61) }, "name", SESSION_MESSAGES.nameTooLong],
    [{ starts_at: "" }, "starts_at", SESSION_MESSAGES.startsInvalid],
    [{ starts_at: "2026-02-30T18:00" }, "starts_at", SESSION_MESSAGES.startsInvalid],
    [{ ends_at: "" }, "ends_at", SESSION_MESSAGES.endsInvalid],
    [{ ends_at: "2026-11-27T18:00" }, "ends_at", SESSION_MESSAGES.endsBeforeStart],
    [{ ends_at: "2026-11-27T17:00" }, "ends_at", SESSION_MESSAGES.endsBeforeStart],
    [{ courts_count: "0" }, "courts_count", SESSION_MESSAGES.courtsInvalid],
    [{ courts_count: "9" }, "courts_count", SESSION_MESSAGES.courtsInvalid],
    [{ courts_count: "2.5" }, "courts_count", SESSION_MESSAGES.courtsInvalid],
    [{ courts_count: null }, "courts_count", SESSION_MESSAGES.courtsInvalid],
    [{ points_to: "12" }, "points_to", SESSION_MESSAGES.pointsInvalid],
    [{ points_to: null }, "points_to", SESSION_MESSAGES.pointsInvalid],
    [{ rotation: "random" }, "rotation", SESSION_MESSAGES.rotationInvalid],
    [{ fee: "" }, "fee", SESSION_MESSAGES.feeInvalid],
    [{ fee: "-5" }, "fee", SESSION_MESSAGES.feeInvalid],
    [{ fee: "12.50" }, "fee", SESSION_MESSAGES.feeInvalid],
    [{ fee: "100001" }, "fee", SESSION_MESSAGES.feeTooHigh],
  ])("%j → %s error", (overrides, field, message) => {
    expect(errorsOf(overrides)).toEqual({ [field]: message });
  });

  it.each([
    [{ courts_count: "1" }],
    [{ courts_count: "8" }],
    [{ points_to: "15" }],
    [{ points_to: "21" }],
    [{ rotation: "winners_stay" }],
    [{ fee: "0" }],
  ])("accepts the allowed value %j", (overrides) => {
    expect(parseNewSession(form(overrides)).ok).toBe(true);
  });

  it("does not compare times when the start is missing", () => {
    expect(errorsOf({ starts_at: "" })).toEqual({ starts_at: SESSION_MESSAGES.startsInvalid });
  });
});
