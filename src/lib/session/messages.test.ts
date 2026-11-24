import { describe, expect, it } from "vitest";
import { AUTH_MESSAGES } from "@/lib/auth/messages";
import { SESSION_ERRORS, sessionErrorMessage } from "./messages";

describe("sessionErrorMessage", () => {
  it("has the Taglish message for a second live session (BR1)", () => {
    expect(sessionErrorMessage({ message: "live_session_exists", code: "P0001" })).toBe(
      "May live na session pa. Tapusin muna iyon bago magsimula ng bago.",
    );
  });

  it.each([
    [{ message: "live_session_exists", code: "P0001" }, SESSION_ERRORS.liveExists],
    [{ message: "invalid_transition", code: "P0001" }, SESSION_ERRORS.changed],
    [{ message: "session_not_found", code: "P0001" }, SESSION_ERRORS.notFound],
    [{ message: "not_staff", code: "42501" }, SESSION_ERRORS.notStaff],
    // Same errcode as not_staff, but anonymous (player) sessions get their own message.
    [{ message: "not_organizer_account", code: "42501" }, AUTH_MESSAGES.notOrganizerAccount],
    [{ message: "permission denied for function start_session", code: "42501" }, SESSION_ERRORS.notStaff],
    [{ message: 'new row violates check constraint "sessions_courts_count_range"', code: "23514" }, SESSION_ERRORS.invalidInput],
    [{ message: 'null value in column "name"', code: "23502" }, SESSION_ERRORS.invalidInput],
    [{ message: "invalid input syntax for type timestamp", code: "22007" }, SESSION_ERRORS.invalidInput],
    [{ message: "fetch failed" }, SESSION_ERRORS.generic],
  ])("%j", (error, expected) => expect(sessionErrorMessage(error)).toBe(expected));
});
