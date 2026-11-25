import { describe, expect, it } from "vitest";
import { isNewCheckIn } from "./players";

describe("QA-05: 'New' on the Queue tab", () => {
  const now = Date.parse("2026-11-25T12:00:00Z");
  it("marks phone check-ins from the last 10 minutes", () => {
    expect(isNewCheckIn({ isWalkIn: false, joinedAt: "2026-11-25T11:55:00Z" }, now)).toBe(true);
    expect(isNewCheckIn({ isWalkIn: false, joinedAt: "2026-11-25T11:49:59Z" }, now)).toBe(false);
  });
  it("not walk-ins (the organizer added them)", () => {
    expect(isNewCheckIn({ isWalkIn: true, joinedAt: "2026-11-25T11:59:00Z" }, now)).toBe(false);
  });
});
