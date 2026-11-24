import { describe, expect, it } from "vitest";
import { duesLabel, matchesMember, MEMBER_MESSAGES, parseMember, sameNameMember } from "./members";

const form = (values: Record<string, string>) => ({ get: (name: string) => values[name] ?? null });

describe("parseMember", () => {
  it("tidies the name and defaults level and dues", () => {
    expect(parseMember(form({ display_name: "  Ana   Reyes " }))).toEqual({
      ok: true,
      data: { display_name: "Ana Reyes", level: "unsure", dues_status: "none", notes: null },
    });
  });
  it("keeps notes, trimmed", () => {
    const parsed = parseMember(form({ display_name: "Ben", level: "advanced", dues_status: "paid", notes: "  Tuwing Biyernes " }));
    expect(parsed).toEqual({ ok: true, data: { display_name: "Ben", level: "advanced", dues_status: "paid", notes: "Tuwing Biyernes" } });
  });
  it("refuses bad input with a message per field", () => {
    expect(parseMember(form({ display_name: "A", level: "pro", dues_status: "maybe", notes: "x".repeat(301) }))).toEqual({
      ok: false,
      errors: {
        display_name: MEMBER_MESSAGES.nameTooShort,
        level: MEMBER_MESSAGES.levelInvalid,
        dues_status: MEMBER_MESSAGES.duesInvalid,
        notes: MEMBER_MESSAGES.notesTooLong,
      },
    });
    expect(parseMember(form({})).ok).toBe(false);
  });
});

describe("member search", () => {
  it("matches any part of the name, ignoring case and accents", () => {
    expect(matchesMember({ name: "Santo Niño" }, "nino")).toBe(true);
    expect(matchesMember({ name: "Ana Reyes" }, "REY")).toBe(true);
    expect(matchesMember({ name: "Ana Reyes" }, "ben")).toBe(false);
    expect(matchesMember({ name: "Ana Reyes" }, "  ")).toBe(true);
  });
  it("finds a member with the same name as a player", () => {
    const members = [{ id: "1", name: "Ana Reyes" }, { id: "2", name: "Ben" }];
    expect(sameNameMember(members, "  ana  reyes")?.id).toBe("1");
    expect(sameNameMember(members, "Ana")).toBeUndefined();
  });
  it("labels dues in words", () => {
    expect(duesLabel("paid")).toBe("Bayad ang dues");
    expect(duesLabel("unpaid")).toBe("Hindi pa bayad ang dues");
    expect(duesLabel("none")).toBe("Walang dues");
  });
});
