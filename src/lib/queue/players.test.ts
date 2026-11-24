import { describe, expect, it } from "vitest";
import {
  levelLabel,
  parseWalkIn,
  parseWalkInPayment,
  tidyName,
  WALK_IN_MESSAGES,
  WALK_IN_PAYMENT_REQUIRED,
} from "./players";

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

describe("parseWalkInPayment (D18: no default with a fee)", () => {
  it("requires a choice when there is a fee", () => {
    expect(parseWalkInPayment(150, "", "")).toEqual({ ok: false, errors: { payment: WALK_IN_PAYMENT_REQUIRED } });
    expect(parseWalkInPayment(150, "bitcoin", "")).toEqual({ ok: false, errors: { payment: WALK_IN_PAYMENT_REQUIRED } });
  });

  it("accepts each choice", () => {
    expect(parseWalkInPayment(150, "cash_received", "")).toEqual({ ok: true, payment: "cash_received" });
    expect(parseWalkInPayment(150, "later", "")).toEqual({ ok: true, payment: "later" });
    expect(parseWalkInPayment(150, "gcash", "1234 5678 90")).toEqual({ ok: true, payment: "gcash" });
  });

  it("GCash needs a valid reference", () => {
    const result = parseWalkInPayment(150, "gcash", "12a");
    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.errors.reference).toMatch(/reference number/);
  });

  it("free sessions skip payment", () => {
    expect(parseWalkInPayment(0, "", "")).toEqual({ ok: true });
  });
});

