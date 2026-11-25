import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cleanDisplayName, isDisplayNameOk } from "./names";

// QA-07: the same cases as the database (supabase/tests/database/name_cases.inc).
type Case = { input: string; cleaned: string; ok: boolean };
function cases(): Case[] {
  const file = readFileSync(join(process.cwd(), "supabase/tests/database/name_cases.inc"), "utf8");
  const match = /\$cases\$([\s\S]*?)\$cases\$/.exec(file);
  if (!match) throw new Error("name_cases.inc: no $cases$ block");
  return JSON.parse(match[1]) as Case[];
}

describe("display names (shared with the database)", () => {
  it.each(cases())("$input → $cleaned (ok: $ok)", ({ input, cleaned, ok }) => {
    expect(cleanDisplayName(input)).toBe(cleaned);
    expect(isDisplayNameOk(cleanDisplayName(input))).toBe(ok);
  });
});
