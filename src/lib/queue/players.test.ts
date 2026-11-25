import { describe, expect, it } from "vitest";
import { en, fil } from "@/lib/i18n/dictionary";
import {
  levelLabel,
  parseWalkIn,
  parseWalkInPayment,
  tidyName,
} from "./players";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(values)) data.set(k, v);
  return data;
}

describe("walk-in input", () => {
  it("accepts a name and level, tidying spaces", () => {
    expect(parseWalkIn(form({ display_name: "  Tito   Boy ", level: "beginner" }), en)).toEqual({
      ok: true,
      data: { display_name: "Tito Boy", level: "beginner" },
    });
    expect(tidyName(" a  b ")).toBe("a b");
  });

  it.each([
    [{ display_name: "", level: "unsure" }, { display_name: en.live.nameRequired }],
    [{ display_name: "A", level: "unsure" }, { display_name: en.live.nameTooShort(2) }],
    [{ display_name: "n".repeat(41), level: "unsure" }, { display_name: en.live.nameTooLong(40) }],
    [{ display_name: "Ana", level: "pro" }, { level: en.live.levelInvalid }],
    [{ display_name: "Ana" }, { level: en.live.levelInvalid }],
  ])("%j is refused", (values, errors) => {
    expect(parseWalkIn(form(values), en)).toEqual({ ok: false, errors });
  });

  it("allows exactly 2 and 40 characters", () => {
    expect(parseWalkIn(form({ display_name: "Al", level: "advanced" }), en).ok).toBe(true);
    expect(parseWalkIn(form({ display_name: "n".repeat(40), level: "advanced" }), en).ok).toBe(true);
  });

  it("labels levels in the device's language", () => {
    expect(levelLabel("unsure", en)).toBe("Not sure");
    expect(levelLabel("unsure", fil)).toBe("Hindi sigurado");
    expect(levelLabel("intermediate", en)).toBe("Intermediate");
  });
});

describe("parseWalkInPayment (D18: no default with a fee)", () => {
  it("requires a choice when there is a fee", () => {
    expect(parseWalkInPayment(150, "", "", en)).toEqual({ ok: false, errors: { payment: en.live.choosePayment } });
    expect(parseWalkInPayment(150, "bitcoin", "", en)).toEqual({ ok: false, errors: { payment: en.live.choosePayment } });
  });

  it("accepts each choice", () => {
    expect(parseWalkInPayment(150, "cash_received", "", en)).toEqual({ ok: true, payment: "cash_received" });
    expect(parseWalkInPayment(150, "later", "", en)).toEqual({ ok: true, payment: "later" });
    expect(parseWalkInPayment(150, "gcash", "1234 5678 90", en)).toEqual({ ok: true, payment: "gcash" });
  });

  it("GCash needs a valid reference", () => {
    const result = parseWalkInPayment(150, "gcash", "12a", en);
    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.errors.reference).toMatch(/reference doesn.t look right/);
  });

  it("free sessions skip payment", () => {
    expect(parseWalkInPayment(0, "", "", en)).toEqual({ ok: true });
  });
});


describe("QA-05: playerNameKey (same rule as private.player_name_key)", () => {
  it("ignores case and spaces", async () => {
    const { playerNameKey } = await import("./players");
    expect(playerNameKey("  Mark   SANTOS ")).toBe(playerNameKey("marksantos"));
    expect(playerNameKey("Mark S.")).not.toBe(playerNameKey("Mark Santos"));
  });
});
