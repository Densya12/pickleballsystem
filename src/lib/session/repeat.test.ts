import { describe, expect, it } from "vitest";
import { repeatDefaults, repeatTimes } from "./repeat";

// All times are Manila (+08:00).
const at = (local: string) => new Date(`${local}:00+08:00`);

describe("repeatTimes", () => {
  const lastStart = at("2026-11-20T18:00");
  const lastEnd = at("2026-11-20T21:00");

  it("uses today when the start time hasn't passed", () => {
    expect(repeatTimes(lastStart, lastEnd, at("2026-11-24T09:30"))).toEqual({
      startsAt: "2026-11-24T18:00",
      endsAt: "2026-11-24T21:00",
    });
  });

  it("uses tomorrow once the start time has passed", () => {
    expect(repeatTimes(lastStart, lastEnd, at("2026-11-24T18:01"))).toEqual({
      startsAt: "2026-11-25T18:00",
      endsAt: "2026-11-25T21:00",
    });
  });

  it("treats exactly the start time as passed", () => {
    expect(repeatTimes(lastStart, lastEnd, at("2026-11-24T18:00")).startsAt).toBe("2026-11-25T18:00");
  });

  it("works on Manila dates, not the server's UTC date", () => {
    // 01:00 in Manila on Nov 25 is still Nov 24 in UTC.
    expect(repeatTimes(lastStart, lastEnd, at("2026-11-25T01:00")).startsAt).toBe("2026-11-25T18:00");
  });

  it("keeps a session that runs past midnight", () => {
    expect(repeatTimes(at("2026-11-20T22:00"), at("2026-11-21T01:00"), at("2026-11-24T12:00"))).toEqual({
      startsAt: "2026-11-24T22:00",
      endsAt: "2026-11-25T01:00",
    });
  });

  it("rolls over the month and year", () => {
    expect(repeatTimes(lastStart, lastEnd, at("2026-12-31T20:00"))).toEqual({
      startsAt: "2027-01-01T18:00",
      endsAt: "2027-01-01T21:00",
    });
  });

  it("keeps the minutes", () => {
    expect(repeatTimes(at("2026-11-20T06:30"), at("2026-11-20T08:45"), at("2026-11-24T06:29"))).toEqual({
      startsAt: "2026-11-24T06:30",
      endsAt: "2026-11-24T08:45",
    });
  });
});

describe("repeatDefaults", () => {
  it("copies every setting the form needs", () => {
    expect(
      repeatDefaults(
        {
          name: "Friday Night",
          starts_at: "2026-11-20T10:00:00Z",
          ends_at: "2026-11-20T13:00:00Z",
          courts_count: 3,
          court_formats: ["doubles", "singles", "doubles"],
          points_to: 15,
          rotation: "winners_stay",
          matchmaking: "same_level",
          pay_first: true,
          fee: 200,
        },
        at("2026-11-24T09:00"),
      ),
    ).toEqual({
      name: "Friday Night",
      starts_at: "2026-11-24T18:00",
      ends_at: "2026-11-24T21:00",
      courts_count: "3",
      court_formats: "doubles,singles,doubles",
      points_to: "15",
      rotation: "winners_stay",
      matchmaking: "same_level",
      pay_first: "on",
      fee: "200",
    });
  });

  it("leaves pay_first off when it was off", () => {
    const defaults = repeatDefaults(
      {
        name: "Chill",
        starts_at: "2026-11-20T10:00:00Z",
        ends_at: "2026-11-20T13:00:00Z",
        courts_count: 1,
        court_formats: ["doubles"],
        points_to: 11,
        rotation: "all_off",
        matchmaking: "fair_line",
        pay_first: false,
        fee: 0,
      },
      at("2026-11-24T09:00"),
    );
    expect(defaults.pay_first).toBe("");
    expect(defaults.fee).toBe("0");
  });
});
