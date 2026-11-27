import { describe, expect, it } from "vitest";
import { en, fil, type Dictionary } from "@/lib/i18n/dictionary";
import {
  accountLine,
  formatAccountNumber,
  methodApp,
  methodName,
  paidWith,
  payToFromRow,
  paymentMethodChoices,
  PAYMENT_METHODS,
  type PaymentMethod,
} from "./method";

const named = (method: PaymentMethod, otherName: string | null = null) => ({ method, otherName });

describe("payment method labels (brand-neutral payments)", () => {
  it.each([
    ["gcash", null, "GCash", "GCash"],
    ["maya", null, "Maya", "Maya"],
    ["bank", null, "Bank transfer", "bank app"],
    ["other", "ShopeePay", "ShopeePay", "ShopeePay"],
    ["other", null, "Other", "Other"],
  ] as const)("%s (%s): %s, checked in your %s", (method, otherName, name, app) => {
    expect(methodName(en, named(method, otherName))).toBe(name);
    expect(methodApp(en, named(method, otherName))).toBe(app);
  });

  it("Taglish keeps brand names; Other falls back to Iba pa", () => {
    expect(methodName(fil, named("gcash"))).toBe("GCash");
    expect(methodName(fil, named("maya"))).toBe("Maya");
    expect(methodName(fil, named("bank"))).toBe("Bank transfer");
    expect(methodName(fil, named("other"))).toBe("Iba pa");
  });

  it("a payment's method: the club's method for transfers, Cash for cash", () => {
    expect(paidWith(en, "gcash", named("maya"))).toBe("Maya");
    expect(paidWith(en, "gcash", named("bank"))).toBe("Bank transfer");
    expect(paidWith(en, "cash", named("maya"))).toBe("Cash");
    expect(paidWith(en, null, named("maya"))).toBe("");
  });

  it("the Settings choices, in order", () => {
    expect(paymentMethodChoices(en).map((c) => c.label)).toEqual(["GCash", "Maya", "Bank transfer", "Other"]);
    expect(paymentMethodChoices(en).map((c) => c.value)).toEqual([...PAYMENT_METHODS]);
  });

  it("account numbers: mobile numbers as 0917 123 4567, others in groups of 4", () => {
    expect(formatAccountNumber("09171234567")).toBe("0917 123 4567");
    expect(formatAccountNumber("001234567890")).toBe("0012 3456 7890");
    expect(formatAccountNumber("12345")).toBe("1234 5");
    expect(accountLine({ accountName: "Juan", accountNumber: "09171234567" })).toBe("Juan · 0917 123 4567");
    expect(accountLine({ accountName: null, accountNumber: "09171234567" })).toBe("0917 123 4567");
    expect(accountLine({ accountName: "Juan", accountNumber: null })).toBeNull();
  });

  it("reads a row; an unknown method falls back to GCash (today's behavior)", () => {
    const row = { payment_method: "maya", payment_method_other: null, gcash_name: "Juan", gcash_number: "09171234567", cash_accepted: false };
    expect(payToFromRow(row)).toEqual({ method: "maya", otherName: null, accountName: "Juan", accountNumber: "09171234567", cashAccepted: false });
    expect(payToFromRow({ ...row, payment_method: "crypto" }).method).toBe("gcash");
  });
});

/**
 * Every string in a dictionary, with functions called on sample arguments.
 * "GCash" may only come from methodName, never from the dictionaries, so a
 * club on another method never sees it.
 */
function allStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => allStrings(v, out));
  else if (typeof value === "function") {
    for (const args of [["Maya", "Maya", "Maya"], [1, 1, 1], [{ name: "A", session: "S", fee: "₱1", method: "Maya", account: "x", courtLabel: "C", gameNumber: 1, winners: null, next: null, waiting: null, finishedPlayerIds: [] }], [true], [false]]) {
      try {
        allStrings(value(...args), out);
      } catch {
        // Some functions need other argument shapes; the ones above cover the payment strings.
      }
    }
  } else if (value && typeof value === "object") Object.values(value).forEach((v) => allStrings(v, out));
  return out;
}

describe("no hard-coded GCash", () => {
  it.each([
    ["en", en],
    ["fil", fil],
  ] as [string, Dictionary][])("the %s dictionary never says GCash (it comes from the club's method)", (_name, dict) => {
    const offenders = allStrings(dict).filter((text) => /gcash/i.test(text));
    expect(offenders).toEqual([]);
  });
});
