import { describe, expect, it } from "vitest";
import {
  MESSAGES,
  isValidGcashNumber,
  normalizeGcashNumber,
  parseClubSettings,
  parseNewClub,
  validateClubName,
} from "./validation";

const form = (entries: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
};

const validSettings = {
  name: "Makati Picklers",
  city: "Makati",
  gcash_name: "Juan Dela Cruz",
  gcash_number: "0917 123 4567",
  default_fee: "150",
  default_points: "11",
  default_rotation: "all_off",
};

describe("normalizeGcashNumber", () => {
  it.each([
    ["0917-123 4567", "09171234567"],
    ["0917 123 4567", "09171234567"],
    ["  09171234567  ", "09171234567"],
    ["0917--123--4567", "09171234567"],
  ])("strips spaces and dashes: %s", (raw, expected) => {
    expect(normalizeGcashNumber(raw)).toBe(expected);
  });

  it.each(["", "   ", " - ", null, undefined])("blank becomes null: %j", (raw) => {
    expect(normalizeGcashNumber(raw)).toBeNull();
  });
});

describe("isValidGcashNumber", () => {
  it.each(["09171234567", "09999999999"])("accepts %s", (n) => expect(isValidGcashNumber(n)).toBe(true));
  it.each(["0917123456", "091712345678", "08171234567", "9171234567", "0917123456a", "+639171234567"])(
    "rejects %s",
    (n) => expect(isValidGcashNumber(n)).toBe(false),
  );
});

describe("validateClubName", () => {
  it("requires a name", () => expect(validateClubName("")).toBe(MESSAGES.nameRequired));
  it("needs at least 2 characters", () => expect(validateClubName("A")).toBe(MESSAGES.nameTooShort));
  it("allows up to 60 characters", () => {
    expect(validateClubName("x".repeat(60))).toBeUndefined();
    expect(validateClubName("x".repeat(61))).toBe(MESSAGES.nameTooLong);
  });
  it("counts emoji as one character", () => expect(validateClubName("🏓🏓")).toBeUndefined());
});

describe("parseNewClub", () => {
  it("trims and turns a blank city into null", () => {
    expect(parseNewClub(form({ name: "  Makati Picklers ", city: "  " }))).toEqual({
      ok: true,
      data: { name: "Makati Picklers", city: null },
    });
  });

  it("returns a Taglish message for a missing name", () => {
    expect(parseNewClub(form({ name: " ", city: "" }))).toEqual({
      ok: false,
      errors: { name: MESSAGES.nameRequired },
    });
  });

  it("limits city length", () => {
    const result = parseNewClub(form({ name: "Club", city: "x".repeat(61) }));
    expect(result).toEqual({ ok: false, errors: { city: MESSAGES.cityTooLong } });
  });
});

describe("parseClubSettings", () => {
  it("parses valid input and normalizes the GCash number", () => {
    expect(parseClubSettings(form(validSettings))).toEqual({
      ok: true,
      data: {
        name: "Makati Picklers",
        city: "Makati",
        gcash_name: "Juan Dela Cruz",
        gcash_number: "09171234567",
        default_fee: 150,
        default_points: 11,
        default_rotation: "all_off",
      },
    });
  });

  it("allows blank GCash fields", () => {
    const result = parseClubSettings(form({ ...validSettings, gcash_name: "", gcash_number: "" }));
    expect(result.ok && result.data.gcash_number).toBeNull();
    expect(result.ok && result.data.gcash_name).toBeNull();
  });

  it("explains a bad GCash number", () => {
    const result = parseClubSettings(form({ ...validSettings, gcash_number: "0817 123 4567" }));
    expect(result).toEqual({ ok: false, errors: { gcash_number: MESSAGES.gcashNumberInvalid } });
  });

  it.each(["-1", "1.5", "abc", "", "₱150"])("rejects fee %j", (fee) => {
    const result = parseClubSettings(form({ ...validSettings, default_fee: fee }));
    expect(result).toEqual({ ok: false, errors: { default_fee: MESSAGES.feeInvalid } });
  });

  it("accepts a fee of 0 and rejects absurd fees", () => {
    expect(parseClubSettings(form({ ...validSettings, default_fee: "0" })).ok).toBe(true);
    expect(parseClubSettings(form({ ...validSettings, default_fee: "100001" }))).toEqual({
      ok: false,
      errors: { default_fee: MESSAGES.feeTooHigh },
    });
  });

  it("only allows 11, 15 or 21 points and known rotations", () => {
    const result = parseClubSettings(
      form({ ...validSettings, default_points: "12", default_rotation: "random" }),
    );
    expect(result).toEqual({
      ok: false,
      errors: { default_points: MESSAGES.pointsInvalid, default_rotation: MESSAGES.rotationInvalid },
    });
  });

  it("reports every invalid field at once", () => {
    const result = parseClubSettings(form({ default_points: "15", default_rotation: "winners_stay" }));
    expect(result.ok).toBe(false);
    expect(!result.ok && Object.keys(result.errors).sort()).toEqual(["default_fee", "name"]);
  });
});
