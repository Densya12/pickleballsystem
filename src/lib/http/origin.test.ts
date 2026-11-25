import { describe, expect, it } from "vitest";
import { allowedHosts, originFromHeaders } from "./origin";

const h = (init: Record<string, string>) => new Headers(init);

describe("originFromHeaders (QA-08)", () => {
  const prod = {
    ALLOWED_HOSTS: "openplay.ph, www.openplay.ph",
    NEXT_PUBLIC_SITE_URL: "https://openplay.ph",
    VERCEL_URL: "pickleball-abc123.vercel.app",
    VERCEL_PROJECT_PRODUCTION_URL: "pickleballsystem.vercel.app",
  };

  it("ignores a forged X-Forwarded-Host and uses the site URL", () => {
    expect(originFromHeaders(h({ "x-forwarded-host": "evil.example", host: "openplay.ph" }), undefined, prod)).toBe(
      "https://openplay.ph",
    );
    expect(originFromHeaders(h({ host: "evil.example" }), "https://evil.example/auth/callback", prod)).toBe(
      "https://openplay.ph",
    );
  });

  it("keeps allowed hosts: custom domains, Vercel's own hosts, localhost", () => {
    expect(originFromHeaders(h({ "x-forwarded-host": "www.openplay.ph" }), undefined, prod)).toBe(
      "https://www.openplay.ph",
    );
    expect(originFromHeaders(h({ "x-forwarded-host": "pickleball-abc123.vercel.app" }), undefined, prod)).toBe(
      "https://pickleball-abc123.vercel.app",
    );
    expect(originFromHeaders(h({ host: "localhost:3100" }), undefined, {})).toBe("http://localhost:3100");
    expect(originFromHeaders(h({ host: "127.0.0.1:3000" }), undefined, {})).toBe("http://127.0.0.1:3000");
  });

  it("compares hosts case-insensitively and takes the first of a proxy chain", () => {
    expect(originFromHeaders(h({ "x-forwarded-host": "OpenPlay.PH" }), undefined, prod)).toBe("https://openplay.ph");
    expect(originFromHeaders(h({ "x-forwarded-host": "evil.example, openplay.ph" }), undefined, prod)).toBe(
      "https://openplay.ph",
    );
  });

  it("only trusts http/https from X-Forwarded-Proto", () => {
    expect(
      originFromHeaders(h({ host: "openplay.ph", "x-forwarded-proto": "javascript" }), undefined, prod),
    ).toBe("https://openplay.ph");
    expect(originFromHeaders(h({ host: "localhost:3100", "x-forwarded-proto": "https" }), undefined, {})).toBe(
      "https://localhost:3100",
    );
  });

  it("works on Vercel with ALLOWED_HOSTS and NEXT_PUBLIC_SITE_URL unset", () => {
    const vercel = { VERCEL_URL: "pickleball-abc123.vercel.app", VERCEL_PROJECT_PRODUCTION_URL: "pickleballsystem.vercel.app" };
    expect(originFromHeaders(h({ "x-forwarded-host": "pickleballsystem.vercel.app" }), undefined, vercel)).toBe(
      "https://pickleballsystem.vercel.app",
    );
    // An unknown host (e.g. a custom domain not yet listed) goes to the production URL, never the header's host.
    expect(originFromHeaders(h({ "x-forwarded-host": "evil.example" }), undefined, vercel)).toBe(
      "https://pickleballsystem.vercel.app",
    );
    // Preview deployment without a production URL: its own deployment host.
    expect(originFromHeaders(h({ "x-forwarded-host": "evil.example" }), undefined, { VERCEL_URL: "x-1.vercel.app" })).toBe(
      "https://x-1.vercel.app",
    );
  });

  it("with no configuration and an unknown host, falls back to localhost, never the header", () => {
    expect(originFromHeaders(h({ "x-forwarded-host": "evil.example" }), "http://evil.example/x", {})).toBe(
      "http://localhost:3000",
    );
  });

  it("parses ALLOWED_HOSTS entries with or without a scheme", () => {
    expect([...allowedHosts({ ALLOWED_HOSTS: " https://A.example/ ,b.example:8443,, " })]).toEqual([
      "a.example",
      "b.example:8443",
    ]);
  });
});
