/**
 * The club's payment method (brand-neutral payments). Stored on clubs and
 * sessions as payment_method ('gcash' | 'maya' | 'bank' | 'other'), the
 * Other name, and cash_accepted. The account name and number keep their
 * column names (gcash_name, gcash_number) for any method, and payments.method
 * stays 'gcash' (paid to the club's account) or 'cash'.
 */
import type { Dictionary } from "@/lib/i18n/dictionary";

export const PAYMENT_METHODS = ["gcash", "maya", "bank", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const OTHER_NAME_MIN = 2;
export const OTHER_NAME_MAX = 30;

/** Where players pay: the method, its account, and whether cash is fine too. */
export type PayTo = {
  method: PaymentMethod;
  /** The method's name when it's "Other" (e.g. "ShopeePay"). */
  otherName: string | null;
  accountName: string | null;
  accountNumber: string | null;
  cashAccepted: boolean;
};

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === "string" && (PAYMENT_METHODS as readonly string[]).includes(value);
}

/** GCash and Maya accounts are mobile numbers. */
export function usesMobileNumber(method: PaymentMethod): boolean {
  return method === "gcash" || method === "maya";
}

/** A clubs or sessions row's payment columns, as a PayTo. */
export function payToFromRow(row: {
  payment_method: string;
  payment_method_other: string | null;
  gcash_name: string | null;
  gcash_number: string | null;
  cash_accepted: boolean;
}): PayTo {
  return {
    method: isPaymentMethod(row.payment_method) ? row.payment_method : "gcash",
    otherName: row.payment_method_other,
    accountName: row.gcash_name,
    accountNumber: row.gcash_number,
    cashAccepted: row.cash_accepted,
  };
}

/** The method's name: "GCash", "Maya", "Bank transfer", or the Other name. Brand names aren't translated. */
export function methodName(t: Dictionary, payTo: Pick<PayTo, "method" | "otherName">): string {
  switch (payTo.method) {
    case "gcash":
      return "GCash";
    case "maya":
      return "Maya";
    case "bank":
      return t.payments.methodBank;
    case "other":
      return payTo.otherName?.trim() || t.payments.methodOther;
  }
}

/** Where the organizer looks for a payment ("Check in your …"): "GCash", "Maya", "bank app", or the Other name. */
export function methodApp(t: Dictionary, payTo: Pick<PayTo, "method" | "otherName">): string {
  return payTo.method === "bank" ? t.payments.appBank : methodName(t, payTo);
}

/** "0917 123 4567" for mobile numbers; other account numbers in groups of 4. */
export function formatAccountNumber(number: string): string {
  if (/^09\d{9}$/.test(number)) return `${number.slice(0, 4)} ${number.slice(4, 7)} ${number.slice(7)}`;
  return /^\d+$/.test(number) ? (number.match(/.{1,4}/g) ?? [number]).join(" ") : number;
}

/** "Juan Cruz · 0917 123 4567", or null without a number. */
export function accountLine(payTo: Pick<PayTo, "accountName" | "accountNumber">): string | null {
  if (!payTo.accountNumber) return null;
  return `${payTo.accountName ? `${payTo.accountName} · ` : ""}${formatAccountNumber(payTo.accountNumber)}`;
}

/** A payment's method as a word: the club's method for 'gcash' (paid to the account), "Cash" for cash. */
export function paidWith(t: Dictionary, method: string | null, payTo: Pick<PayTo, "method" | "otherName">): string {
  if (method === "gcash") return methodName(t, payTo);
  if (method === "cash") return t.payments.cash;
  return "";
}

/** The choices in Settings › Club details › Payment. */
export function paymentMethodChoices(t: Dictionary): { value: PaymentMethod; label: string }[] {
  return PAYMENT_METHODS.map((method) => ({ value: method, label: method === "other" ? t.payments.methodOther : methodName(t, { method, otherName: null }) }));
}
