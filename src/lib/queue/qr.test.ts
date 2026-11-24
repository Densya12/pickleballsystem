import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { normalizeJoinCode, qrSvg } = await import("./qr");

describe("join codes and QR", () => {
  it("normalizes case and spaces", () => {
    expect(normalizeJoinCode(" abc234 ")).toBe("ABC234");
  });

  it.each(["ABC10O", "ABCDE", "ABCDEFG", "ABC-23", ""])("refuses %j", (code) => {
    expect(normalizeJoinCode(code)).toBeNull();
  });

  it("draws the QR as an SVG locally", async () => {
    const svg = await qrSvg("http://localhost:3000/j/ABC234");
    expect(svg).toMatch(/^<svg/);
    expect(svg).toContain("#111412");
  });
});
