import { describe, expect, it } from "vitest";
import { formatCourts, formatGcashNumber, formatPeso } from "./format";

describe("format", () => {
  it("formats pesos with thousands separators", () => {
    expect(formatPeso(0)).toBe("₱0");
    expect(formatPeso(150)).toBe("₱150");
    expect(formatPeso(1500)).toBe("₱1,500");
  });

  it("groups a GCash number for reading", () => {
    expect(formatGcashNumber("09171234567")).toBe("0917 123 4567");
    expect(formatGcashNumber("12345")).toBe("12345");
  });

  it("counts courts", () => {
    expect(formatCourts(1)).toBe("1 court");
    expect(formatCourts(3)).toBe("3 courts");
  });
});
