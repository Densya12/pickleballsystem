import { describe, expect, it } from "vitest";
import { en, fil } from "@/lib/i18n/dictionary";
import { loginErrorMessage, otpErrorMessage, validateEmail } from "./messages";

describe("validateEmail", () => {
  it("requires an email", () => expect(validateEmail("  ", en)).toBe(en.auth.emailRequired));
  it.each(["juan", "juan@", "juan@gmail", "ju an@gmail.com"])("rejects %s", (e) => expect(validateEmail(e, en)).toBe(en.auth.emailInvalid));
  it("accepts a normal email (with spaces around)", () => expect(validateEmail(" juan@gmail.com ", en)).toBeUndefined());
});

describe("otpErrorMessage", () => {
  it.each([
    { status: 429, message: "Too many requests" },
    { code: "over_email_send_rate_limit", status: 429 },
    { code: "email_address_not_authorized", status: 400 },
    { status: 400, message: "Email address not authorized" },
    { status: 400, message: "For security purposes, you can only request this after 42 seconds." },
  ])("refused email → try Google (%j)", (error) => {
    expect(otpErrorMessage(error, en)).toBe("We can't send a sign-in link right now. Try Google instead.");
    expect(otpErrorMessage(error, fil)).toBe("Hindi maipadala ang login link ngayon. Subukan ang Google sign-in.");
  });

  it("invalid address from the server", () =>
    expect(otpErrorMessage({ status: 400, message: "Unable to validate email address: invalid format" }, en)).toBe(en.auth.emailInvalid));

  it("anything else is a generic retry", () => expect(otpErrorMessage({ status: 500, message: "boom" }, en)).toBe(en.auth.emailFailed));
});

describe("loginErrorMessage", () => {
  it("maps callback error codes", () => {
    expect(loginErrorMessage("link", en)).toBe(en.auth.linkExpired);
    expect(loginErrorMessage("auth", en)).toBe(en.auth.callbackFailed);
    expect(loginErrorMessage(undefined, en)).toBeUndefined();
  });

  it("a failed login link names the usual cause (another browser) and the way out", () => {
    expect(loginErrorMessage("link", en)).toMatch(/opened in another browser/);
    expect(loginErrorMessage("link", fil)).toMatch(/binuksan sa ibang browser/);
  });
});
