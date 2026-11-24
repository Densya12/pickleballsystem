import { describe, expect, it } from "vitest";
import { maskReference, normalizeReference } from "./reference";

describe("GCash reference (BR15)", () => {
  it.each([
    ["1234567890", "1234567890"],
    ["1234 5678 90", "1234567890"],
    ["1234-5678-90", "1234567890"],
    [" 12 34-56 ", "123456"],
    ["12345678901234567890", "12345678901234567890"],
  ])("%j -> %j", (raw, digits) => expect(normalizeReference(raw)).toBe(digits));

  it.each(["", "12345", "123456789012345678901", "1234.5678", "abc123456", "1234_5678"])("refuses %j", (raw) => {
    expect(normalizeReference(raw)).toBeNull();
  });

  it("masks all but the last 4 digits", () => {
    expect(maskReference("1234567890")).toBe("•••• 7890");
  });
});
