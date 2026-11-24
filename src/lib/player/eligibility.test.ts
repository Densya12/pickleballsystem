import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isCallable, isHeld } from "./state";

/**
 * The shared fixture: the same file pgTAP includes (13_payments.test.sql) to
 * check private.eligible_players. Both sides must give the same answer.
 */
type Case = { status: string; payment: string; payFirst: boolean; fee: number; eligible: boolean };

function loadCases(): Case[] {
  const file = readFileSync(join(process.cwd(), "supabase/tests/database/eligibility_cases.inc"), "utf8");
  const match = /\$cases\$(\[[\s\S]*?\])\$cases\$/.exec(file);
  if (!match) throw new Error("eligibility_cases.inc: no $cases$ block");
  return JSON.parse(match[1]) as Case[];
}

const cases = loadCases();

describe("isCallable matches the shared eligibility fixture (BR6/BR14)", () => {
  it("has every case", () => expect(cases).toHaveLength(36));

  it.each(cases)("$status / $payment / pay_first=$payFirst / fee=$fee -> $eligible", (c) => {
    expect(isCallable({ status: c.status, paymentStatus: c.payment }, { payFirst: c.payFirst, fee: c.fee })).toBe(c.eligible);
  });

  it("'held' means queued, pay_first with a fee, and not yet paid", () => {
    for (const c of cases) {
      const held = isHeld({ status: c.status, paymentStatus: c.payment }, { payFirst: c.payFirst, fee: c.fee });
      expect(held).toBe(c.status === "queued" && c.payFirst && c.fee > 0 && c.payment === "unpaid");
    }
  });
});
