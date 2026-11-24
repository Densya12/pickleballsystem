import { describe, expect, it } from "vitest";
import { isPublicPath, loginPath, safeNextPath } from "./paths";

describe("isPublicPath", () => {
  it.each(["/login", "/auth/callback", "/auth/confirm", "/design-system"])("%s is public", (p) =>
    expect(isPublicPath(p)).toBe(true),
  );
  it.each(["/", "/settings", "/club/new", "/invite/abc", "/loginx", "/authors"])("%s is private", (p) =>
    expect(isPublicPath(p)).toBe(false),
  );
});

describe("safeNextPath", () => {
  it.each(["/settings", "/invite/abc_123-x", "/settings?tab=1"])("keeps same-site path %s", (p) =>
    expect(safeNextPath(p)).toBe(p),
  );
  it.each([
    null,
    undefined,
    "",
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "javascript:alert(1)",
    "/login",
    "/login?next=/x",
    "/auth/callback",
    "/a\nb",
  ])("falls back to / for %j", (p) => expect(safeNextPath(p)).toBe("/"));
});

describe("loginPath", () => {
  it("adds an encoded next for private pages", () => {
    expect(loginPath("/invite/abc")).toBe("/login?next=%2Finvite%2Fabc");
  });
  it("omits next for home and unsafe values", () => {
    expect(loginPath("/")).toBe("/login");
    expect(loginPath("//evil.com")).toBe("/login");
    expect(loginPath()).toBe("/login");
  });
});
