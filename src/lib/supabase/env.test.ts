import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabaseEnv, readSupabaseEnv } from "./env";

const URL = "https://project.supabase.co";

function setEnv(vars: { url?: string; publishable?: string; anon?: string }) {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", vars.url);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", vars.publishable);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", vars.anon);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("readSupabaseEnv", () => {
  it("uses the publishable key when set", () => {
    setEnv({ url: URL, publishable: "sb_publishable_x", anon: "anon-y" });
    expect(readSupabaseEnv()).toEqual({ url: URL, key: "sb_publishable_x" });
  });

  it("falls back to the anon key when only ANON_KEY is set (current Vercel setup)", () => {
    setEnv({ url: URL, anon: "anon-y" });
    expect(readSupabaseEnv()).toEqual({ url: URL, key: "anon-y" });
  });

  it("falls back to the anon key when the publishable key is blank", () => {
    setEnv({ url: URL, publishable: "", anon: "anon-y" });
    expect(readSupabaseEnv()).toEqual({ url: URL, key: "anon-y" });
  });

  it("returns null when no key is set", () => {
    setEnv({ url: URL });
    expect(readSupabaseEnv()).toBeNull();
  });

  it("returns null when the URL is missing", () => {
    setEnv({ anon: "anon-y" });
    expect(readSupabaseEnv()).toBeNull();
  });
});

describe("getSupabaseEnv", () => {
  it("throws a setup hint when config is missing", () => {
    setEnv({});
    expect(() => getSupabaseEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("returns the anon-key config", () => {
    setEnv({ url: URL, anon: "anon-y" });
    expect(getSupabaseEnv()).toEqual({ url: URL, key: "anon-y" });
  });
});
