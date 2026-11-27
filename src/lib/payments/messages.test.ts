import { describe, expect, it } from "vitest";
import { en, fil } from "@/lib/i18n/dictionary";
import { paymentErrorMessage, paymentStatusText, reminderMessage } from "./messages";
import type { PayTo } from "./method";

const payTo = (over: Partial<PayTo> = {}): PayTo => ({
  method: "gcash",
  otherName: null,
  accountName: "Juan Dela Cruz",
  accountNumber: "09171234567",
  cashAccepted: true,
  ...over,
});

describe("payment messages", () => {
  it("reminder, in English (default) and Taglish", () => {
    const input = { name: "Ana", session: "Friday Night Open Play", fee: 150, payTo: payTo() };
    expect(reminderMessage(input, en)).toBe(
      "Hi Ana! A friendly reminder about your payment for Friday Night Open Play: ₱150. GCash: Juan Dela Cruz 0917 123 4567. Thank you!",
    );
    expect(reminderMessage(input, fil)).toBe(
      "Hi Ana! Paalala lang po sa bayad para sa Friday Night Open Play: ₱150. GCash: Juan Dela Cruz 0917 123 4567. Salamat po!",
    );
  });

  it("reminder names the club's method: Maya, Bank transfer, Other", () => {
    const base = { name: "Ana", session: "Open Play", fee: 150 };
    expect(reminderMessage({ ...base, payTo: payTo({ method: "maya" }) }, en)).toBe(
      "Hi Ana! A friendly reminder about your payment for Open Play: ₱150. Maya: Juan Dela Cruz 0917 123 4567. Thank you!",
    );
    expect(reminderMessage({ ...base, payTo: payTo({ method: "bank", accountNumber: "001234567890" }) }, en)).toBe(
      "Hi Ana! A friendly reminder about your payment for Open Play: ₱150. Bank transfer: Juan Dela Cruz 0012 3456 7890. Thank you!",
    );
    expect(reminderMessage({ ...base, payTo: payTo({ method: "other", otherName: "ShopeePay" }) }, fil)).toContain("ShopeePay: Juan Dela Cruz 0917 123 4567.");
  });

  it("reminder without an account number leaves that part out", () => {
    expect(reminderMessage({ name: "Ben", session: "Open Play", fee: 1500, payTo: payTo({ accountName: null, accountNumber: null }) }, fil)).toBe(
      "Hi Ben! Paalala lang po sa bayad para sa Open Play: ₱1,500. Salamat po!",
    );
  });

  it("player status line", () => {
    expect(paymentStatusText("confirmed", en)).toBe("Paid");
    expect(paymentStatusText("pending", en)).toBe("Waiting for the organizer");
    expect(paymentStatusText("unpaid", fil)).toBe("Hindi pa bayad");
  });

  it("banners", () => {
    expect(en.payments.confirmedTransfer("Ana", "Maya")).toBe("Ana's payment (Maya) is confirmed.");
    expect(fil.payments.confirmedTransfer("Ana", "GCash")).toBe("Kumpirmado ang bayad ni Ana (GCash).");
    expect(en.payments.confirmedCash("Ben")).toBe("Got Ben's cash.");
    expect(fil.payments.confirmedCash("Ben")).toBe("Natanggap ang cash ni Ben.");
    expect(en.payments.undone("Ana")).toBe("Ana is marked unpaid again.");
  });

  it.each([
    ["invalid_reference", en.payments.invalidReference(6, 20)],
    ["already_paid", en.payments.alreadyPaid],
    ["no_payment_needed", en.payments.notNeeded],
    ["invalid_payment_method", en.payments.invalidMethod],
    ["invalid_payment_status", en.payments.statusChanged],
  ])("%s", (message, expected) => expect(paymentErrorMessage({ message, code: "P0001" }, en)).toBe(expected));

  it("leaves other errors to the caller", () => {
    expect(paymentErrorMessage({ message: "court_busy" }, en)).toBeNull();
  });
});
