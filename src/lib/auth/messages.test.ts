import { describe, expect, it } from "vitest";
import { AUTH_MESSAGES, loginErrorMessage, otpErrorMessage, validateEmail } from "./messages";

describe("validateEmail", () => {
  it("requires an email", () => expect(validateEmail("  ")).toBe(AUTH_MESSAGES.emailRequired));
  it.each(["juan", "juan@", "juan@gmail", "ju an@gmail.com"])("rejects %s", (e) =>
    expect(validateEmail(e)).toBe(AUTH_MESSAGES.emailInvalid),
  );
  it("accepts a normal email (with spaces around)", () =>
    expect(validateEmail(" juan@gmail.com ")).toBeUndefined());
});

describe("otpErrorMessage", () => {
  it.each([
    { status: 429, message: "Too many requests" },
    { code: "over_email_send_rate_limit", status: 429 },
    { code: "email_address_not_authorized", status: 400 },
    { status: 400, message: "Email address not authorized" },
    { status: 400, message: "For security purposes, you can only request this after 42 seconds." },
  ])("refused email → try Google (%j)", (error) => {
    expect(otpErrorMessage(error)).toBe(
      "Hindi maipadala ang login link ngayon. Subukan ang Google sign-in.",
    );
  });

  it("invalid address from the server", () =>
    expect(otpErrorMessage({ status: 400, message: "Unable to validate email address: invalid format" })).toBe(
      AUTH_MESSAGES.emailInvalid,
    ));

  it("anything else is a generic retry", () =>
    expect(otpErrorMessage({ status: 500, message: "boom" })).toBe(AUTH_MESSAGES.emailFailed));
});

describe("loginErrorMessage", () => {
  it("maps callback error codes", () => {
    expect(loginErrorMessage("link")).toBe(AUTH_MESSAGES.linkExpired);
    expect(loginErrorMessage("auth")).toBe(AUTH_MESSAGES.callbackFailed);
    expect(loginErrorMessage(undefined)).toBeUndefined();
  });
});
