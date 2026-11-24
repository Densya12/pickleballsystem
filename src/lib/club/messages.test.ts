import { describe, expect, it } from "vitest";
import { CLUB_ERRORS, clubErrorMessage, inviteExpiryText, inviteStatusMessage } from "./messages";

describe("clubErrorMessage", () => {
  it.each([
    [{ message: "last_owner", code: "P0001" }, CLUB_ERRORS.lastOwner],
    [{ message: "invite_used", code: "P0001" }, CLUB_ERRORS.inviteUsed],
    [{ message: "invite_expired", code: "P0001" }, CLUB_ERRORS.inviteExpired],
    [{ message: "invite_revoked", code: "P0001" }, CLUB_ERRORS.inviteRevoked],
    [{ message: "invite_invalid", code: "P0001" }, CLUB_ERRORS.inviteInvalid],
    [{ message: "not_owner", code: "42501" }, CLUB_ERRORS.ownerOnly],
    [{ message: "new row violates row-level security policy", code: "42501" }, CLUB_ERRORS.ownerOnly],
    [{ message: "violates check constraint", code: "23514" }, CLUB_ERRORS.invalidInput],
    [{ message: "fetch failed" }, CLUB_ERRORS.generic],
  ])("%j", (error, expected) => expect(clubErrorMessage(error)).toBe(expected));
});

describe("inviteStatusMessage", () => {
  it("has a message for each unusable state", () => {
    expect(inviteStatusMessage("expired")).toBe(CLUB_ERRORS.inviteExpired);
    expect(inviteStatusMessage("used")).toBe(CLUB_ERRORS.inviteUsed);
    expect(inviteStatusMessage("revoked")).toBe(CLUB_ERRORS.inviteRevoked);
    expect(inviteStatusMessage("invalid")).toBe(CLUB_ERRORS.inviteInvalid);
  });
});

describe("inviteExpiryText", () => {
  const now = new Date("2026-11-24T00:00:00Z");
  const at = (hours: number) => new Date(now.getTime() + hours * 3_600_000).toISOString();
  it("counts days for a fresh invite", () => expect(inviteExpiryText(at(7 * 24), now)).toBe("Mag-e-expire sa loob ng 7 araw"));
  it("rounds part days up", () => expect(inviteExpiryText(at(30), now)).toBe("Mag-e-expire sa loob ng 2 araw"));
  it("switches to hours on the last day", () => expect(inviteExpiryText(at(5), now)).toBe("Mag-e-expire sa loob ng 5 oras"));
});
