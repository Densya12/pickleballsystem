import { describe, expect, it } from "vitest";
import { confirmedBanner, PAYMENT_ERRORS, paymentErrorMessage, paymentStatusText, reminderMessage, undoneBanner } from "./messages";

describe("payment messages", () => {
  it("reminder (Paalalahanan)", () => {
    expect(
      reminderMessage({ name: "Ana", session: "Friday Night Open Play", fee: 150, gcashName: "Juan Dela Cruz", gcashNumber: "09171234567" }),
    ).toBe("Hi Ana! Paalala lang po sa bayad para sa Friday Night Open Play: ₱150. GCash: Juan Dela Cruz 0917 123 4567. Salamat po!");
  });

  it("reminder without a club GCash leaves that part out", () => {
    expect(reminderMessage({ name: "Ben", session: "Open Play", fee: 1500, gcashName: null, gcashNumber: null })).toBe(
      "Hi Ben! Paalala lang po sa bayad para sa Open Play: ₱1,500. Salamat po!",
    );
  });

  it("player status line", () => {
    expect(paymentStatusText("confirmed")).toBe("Bayad na");
    expect(paymentStatusText("pending")).toBe("Hinihintay ang kumpirmasyon ng organizer");
    expect(paymentStatusText("unpaid")).toBe("Hindi pa bayad");
  });

  it("banners", () => {
    expect(confirmedBanner("Ana", "gcash")).toBe("Kumpirmado ang GCash ni Ana.");
    expect(confirmedBanner("Ben", "cash")).toBe("Natanggap ang cash ni Ben.");
    expect(undoneBanner("Ana")).toBe("Ibinalik sa hindi pa bayad si Ana.");
  });

  it.each([
    ["invalid_reference", PAYMENT_ERRORS.invalidReference],
    ["already_paid", PAYMENT_ERRORS.alreadyPaid],
    ["no_payment_needed", PAYMENT_ERRORS.notNeeded],
    ["invalid_payment_method", PAYMENT_ERRORS.invalidMethod],
    ["invalid_payment_status", PAYMENT_ERRORS.statusChanged],
  ])("%s", (message, expected) => expect(paymentErrorMessage({ message, code: "P0001" })).toBe(expected));

  it("leaves other errors to the caller", () => {
    expect(paymentErrorMessage({ message: "court_busy" })).toBeNull();
  });
});
