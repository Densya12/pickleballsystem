import { describe, expect, it } from "vitest";
import { levelLabel, parseWalkIn, tidyName, WALK_IN_MESSAGES } from "./players";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(values)) data.set(k, v);
  return data;
}

describe("walk-in input", () => {
  it("accepts a name and level, tidying spaces", () => {
    expect(parseWalkIn(form({ display_name: "  Tito   Boy ", level: "beginner" }))).toEqual({
      ok: true,
      data: { display_name: "Tito Boy", level: "beginner" },
    });
    expect(tidyName(" a  b ")).toBe("a b");
  });

  it.each([
    [{ display_name: "", level: "unsure" }, { display_name: WALK_IN_MESSAGES.nameRequired }],
    [{ display_name: "A", level: "unsure" }, { display_name: WALK_IN_MESSAGES.nameTooShort }],
    [{ display_name: "n".repeat(41), level: "unsure" }, { display_name: WALK_IN_MESSAGES.nameTooLong }],
    [{ display_name: "Ana", level: "pro" }, { level: WALK_IN_MESSAGES.levelInvalid }],
    [{ display_name: "Ana" }, { level: WALK_IN_MESSAGES.levelInvalid }],
  ])("%j is refused", (values, errors) => {
    expect(parseWalkIn(form(values))).toEqual({ ok: false, errors });
  });

  it("allows exactly 2 and 40 characters", () => {
    expect(parseWalkIn(form({ display_name: "Al", level: "advanced" })).ok).toBe(true);
    expect(parseWalkIn(form({ display_name: "n".repeat(40), level: "advanced" })).ok).toBe(true);
  });

  it("labels levels in Taglish", () => {
    expect(levelLabel("unsure")).toBe("Hindi sigurado");
    expect(levelLabel("intermediate")).toBe("Intermediate");
  });
});
