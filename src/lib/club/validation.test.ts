import { describe, expect, it } from "vitest";
import { en } from "@/lib/i18n/dictionary";
import {
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
  payment_method: "gcash",
  payment_method_other: "",
  cash_accepted: "on",
  default_points: "11",
  default_rotation: "all_off",
  default_matchmaking: "same_level",
  default_call_mode: "wait",
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
  it("requires a name", () => expect(validateClubName("", en)).toBe(en.club.nameRequired));
  it("needs at least 2 characters", () => expect(validateClubName("A", en)).toBe(en.club.nameTooShort(2)));
  it("allows up to 60 characters", () => {
    expect(validateClubName("x".repeat(60), en)).toBeUndefined();
    expect(validateClubName("x".repeat(61), en)).toBe(en.club.tooLong(60));
  });
  it("counts emoji as one character", () => expect(validateClubName("🏓🏓", en)).toBeUndefined());
});

describe("parseNewClub", () => {
  it("trims and turns a blank city into null", () => {
    expect(parseNewClub(form({ name: "  Makati Picklers ", city: "  " }), en)).toEqual({
      ok: true,
      data: { name: "Makati Picklers", city: null },
    });
  });

  it("returns a Taglish message for a missing name", () => {
    expect(parseNewClub(form({ name: " ", city: "" }), en)).toEqual({
      ok: false,
      errors: { name: en.club.nameRequired },
    });
  });

  it("limits city length", () => {
    const result = parseNewClub(form({ name: "Club", city: "x".repeat(61) }), en);
    expect(result).toEqual({ ok: false, errors: { city: en.club.tooLong(60) } });
  });
});

describe("parseClubSettings", () => {
  it("parses valid input and normalizes the GCash number", () => {
    expect(parseClubSettings(form(validSettings), en)).toEqual({
      ok: true,
      data: {
        name: "Makati Picklers",
        city: "Makati",
        gcash_name: "Juan Dela Cruz",
        gcash_number: "09171234567",
        default_fee: 150,
        payment_method: "gcash",
        payment_method_other: null,
        cash_accepted: true,
        default_points: 11,
        default_rotation: "all_off",
        default_matchmaking: "same_level",
        default_call_mode: "wait",
      },
    });
  });

  it("allows blank GCash fields", () => {
    const result = parseClubSettings(form({ ...validSettings, gcash_name: "", gcash_number: "" }), en);
    expect(result.ok && result.data.gcash_number).toBeNull();
    expect(result.ok && result.data.gcash_name).toBeNull();
  });

  it("explains a bad GCash or Maya number (a mobile number)", () => {
    const result = parseClubSettings(form({ ...validSettings, gcash_number: "0817 123 4567" }), en);
    expect(result).toEqual({ ok: false, errors: { gcash_number: en.club.mobileNumberInvalid } });
    const maya = parseClubSettings(form({ ...validSettings, payment_method: "maya", gcash_number: "001234567890" }), en);
    expect(maya).toEqual({ ok: false, errors: { gcash_number: en.club.mobileNumberInvalid } });
  });

  it("bank and other accounts: 4-30 digits (spaces and dashes are fine)", () => {
    const bank = parseClubSettings(form({ ...validSettings, payment_method: "bank", gcash_number: "0012-3456 7890" }), en);
    expect(bank.ok && bank.data).toMatchObject({ payment_method: "bank", gcash_number: "001234567890", payment_method_other: null });
    const short = parseClubSettings(form({ ...validSettings, payment_method: "bank", gcash_number: "123" }), en);
    expect(short).toEqual({ ok: false, errors: { gcash_number: en.club.accountNumberInvalid(4, 30) } });
  });

  it("Other needs its name, 2-30 characters; other methods drop it", () => {
    const missing = parseClubSettings(form({ ...validSettings, payment_method: "other", payment_method_other: " " }), en);
    expect(missing).toEqual({ ok: false, errors: { payment_method_other: en.club.otherNameInvalid(2, 30) } });
    const long = parseClubSettings(form({ ...validSettings, payment_method: "other", payment_method_other: "x".repeat(31) }), en);
    expect(long.ok).toBe(false);
    const ok = parseClubSettings(form({ ...validSettings, payment_method: "other", payment_method_other: " ShopeePay " }), en);
    expect(ok.ok && ok.data.payment_method_other).toBe("ShopeePay");
    const dropped = parseClubSettings(form({ ...validSettings, payment_method: "maya", payment_method_other: "ShopeePay" }), en);
    expect(dropped.ok && dropped.data.payment_method_other).toBeNull();
  });

  it("cash accepted: on or off; an unknown method is refused", () => {
    const off = parseClubSettings(form({ ...validSettings, cash_accepted: "off" }), en);
    expect(off.ok && off.data.cash_accepted).toBe(false);
    expect(parseClubSettings(form({ ...validSettings, cash_accepted: "maybe" }), en)).toEqual({
      ok: false,
      errors: { cash_accepted: en.club.cashAcceptedInvalid },
    });
    expect(parseClubSettings(form({ ...validSettings, payment_method: "crypto" }), en)).toEqual({
      ok: false,
      errors: { payment_method: en.club.paymentMethodInvalid },
    });
  });

  it.each(["-1", "1.5", "abc", "", "₱150"])("rejects fee %j", (fee) => {
    const result = parseClubSettings(form({ ...validSettings, default_fee: fee }), en);
    expect(result).toEqual({ ok: false, errors: { default_fee: en.club.feeInvalid } });
  });

  it("accepts a fee of 0 and rejects absurd fees", () => {
    expect(parseClubSettings(form({ ...validSettings, default_fee: "0" }), en).ok).toBe(true);
    expect(parseClubSettings(form({ ...validSettings, default_fee: "100001" }), en)).toEqual({
      ok: false,
      errors: { default_fee: en.club.feeTooHigh },
    });
  });

  it("only allows 11, 15 or 21 points and known rotations", () => {
    const result = parseClubSettings(
      form({ ...validSettings, default_points: "12", default_rotation: "random" }), en
    );
    expect(result).toEqual({
      ok: false,
      errors: { default_points: en.club.pointsInvalid, default_rotation: en.club.rotationInvalid },
    });
  });

  it("reports every invalid field at once", () => {
    const result = parseClubSettings(form({ default_points: "15", default_rotation: "winners_stay", default_matchmaking: "mixed", default_call_mode: "auto_call", payment_method: "gcash", cash_accepted: "on" }), en);
    expect(result.ok).toBe(false);
    expect(!result.ok && Object.keys(result.errors).sort()).toEqual(["default_fee", "name"]);
  });
});
