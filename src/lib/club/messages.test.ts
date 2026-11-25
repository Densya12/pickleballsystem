import { describe, expect, it } from "vitest";
import { en, fil } from "@/lib/i18n/dictionary";
import { clubErrorMessage, inviteExpiryText, inviteStatusMessage } from "./messages";

describe("clubErrorMessage", () => {
  it.each([
    [{ message: "last_owner", code: "P0001" }, en.club.lastOwner],
    [{ message: "invite_used", code: "P0001" }, en.club.inviteUsed],
    [{ message: "invite_expired", code: "P0001" }, en.club.inviteExpired],
    [{ message: "invite_revoked", code: "P0001" }, en.club.inviteRevoked],
    [{ message: "invite_invalid", code: "P0001" }, en.club.inviteInvalid],
    [{ message: "not_owner", code: "42501" }, en.club.ownerOnly],
    // Same errcode as not_owner, but must not be shown as "owner only".
    [{ message: "not_organizer_account", code: "42501" }, en.auth.notOrganizerAccount],
    [{ message: "new row violates row-level security policy", code: "42501" }, en.club.ownerOnly],
    [{ message: "violates check constraint", code: "23514" }, en.club.invalidInput],
    [{ message: "fetch failed" }, en.club.generic],
  ])("%j", (error, expected) => expect(clubErrorMessage(error, en)).toBe(expected));

  it("speaks Taglish when the device is set to Taglish", () => {
    expect(clubErrorMessage({ message: "last_owner" }, fil)).toBe("Hindi pwedeng alisin ang huling owner ng club.");
  });
});

describe("inviteStatusMessage", () => {
  it("has a message for each unusable state", () => {
    expect(inviteStatusMessage("expired", en)).toBe(en.club.inviteExpired);
    expect(inviteStatusMessage("used", en)).toBe(en.club.inviteUsed);
    expect(inviteStatusMessage("revoked", en)).toBe(en.club.inviteRevoked);
    expect(inviteStatusMessage("invalid", en)).toBe(en.club.inviteInvalid);
  });
});

describe("inviteExpiryText", () => {
  const now = new Date("2026-11-24T00:00:00Z");
  const at = (hours: number) => new Date(now.getTime() + hours * 3_600_000).toISOString();
  it("counts days for a fresh invite", () => {
    expect(inviteExpiryText(at(7 * 24), now, en)).toBe("Expires in 7 days");
    expect(inviteExpiryText(at(7 * 24), now, fil)).toBe("Mag-e-expire sa loob ng 7 araw");
  });
  it("rounds part days up", () => expect(inviteExpiryText(at(30), now, en)).toBe("Expires in 2 days"));
  it("switches to hours on the last day", () => expect(inviteExpiryText(at(5), now, en)).toBe("Expires in 5 hours"));
});
