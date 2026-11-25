import { describe, expect, it } from "vitest";
import { en, fil } from "@/lib/i18n/dictionary";
import { duesLabel, matchesMember, parseMember, sameNameMember } from "./members";

const form = (values: Record<string, string>) => ({ get: (name: string) => values[name] ?? null });

describe("parseMember", () => {
  it("tidies the name and defaults level and dues", () => {
    expect(parseMember(form({ display_name: "  Ana   Reyes " }), en)).toEqual({
      ok: true,
      data: { display_name: "Ana Reyes", level: "unsure", dues_status: "none", notes: null },
    });
  });
  it("keeps notes, trimmed", () => {
    const parsed = parseMember(form({ display_name: "Ben", level: "advanced", dues_status: "paid", notes: "  Tuwing Biyernes " }), en);
    expect(parsed).toEqual({ ok: true, data: { display_name: "Ben", level: "advanced", dues_status: "paid", notes: "Tuwing Biyernes" } });
  });
  it("refuses bad input with a message per field", () => {
    expect(parseMember(form({ display_name: "A", level: "pro", dues_status: "maybe", notes: "x".repeat(301) }), en)).toEqual({
      ok: false,
      errors: {
        display_name: en.members.nameTooShort(2),
        level: en.members.levelInvalid,
        dues_status: en.members.duesInvalid,
        notes: en.members.notesTooLong(300),
      },
    });
    expect(parseMember(form({}), en).ok).toBe(false);
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
    expect(duesLabel("paid", en)).toBe("Dues paid");
    expect(duesLabel("unpaid", en)).toBe("Dues unpaid");
    expect(duesLabel("none", en)).toBe("No dues");
    expect(duesLabel("paid", fil)).toBe("Bayad ang dues");
  });
});

describe("QA-07: member names", () => {
  it("strips invisible characters and needs a letter or number", () => {
    const form = (name: string) => ({ get: (k: string) => (k === "display_name" ? name : null) });
    expect(parseMember(form("⁦Ben Cruz⁩"), en)).toMatchObject({ ok: true, data: { display_name: "Ben Cruz" } });
    expect(parseMember(form("..."), en)).toMatchObject({ ok: false, errors: { display_name: en.members.nameNeedsLetter } });
  });
});
