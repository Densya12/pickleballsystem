import { describe, expect, it } from "vitest";
import { formatPeso } from "./format";

describe("format", () => {
  it("formats pesos with thousands separators", () => {
    expect(formatPeso(0)).toBe("₱0");
    expect(formatPeso(150)).toBe("₱150");
    expect(formatPeso(1500)).toBe("₱1,500");
  });
});
