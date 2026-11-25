import { describe, expect, it } from "vitest";
import { en, fil } from "@/lib/i18n/dictionary";
import { sessionErrorMessage } from "./messages";

describe("sessionErrorMessage", () => {
  it("explains a second live session (BR1), in both languages", () => {
    expect(sessionErrorMessage({ message: "live_session_exists", code: "P0001" }, en)).toBe(
      "Another session is live. End it before starting a new one.",
    );
    expect(sessionErrorMessage({ message: "live_session_exists", code: "P0001" }, fil)).toBe(
      "May live na session pa. Tapusin muna iyon bago magsimula ng bago.",
    );
  });

  it.each([
    [{ message: "live_session_exists", code: "P0001" }, en.session.liveExists],
    [{ message: "invalid_transition", code: "P0001" }, en.session.changed],
    [{ message: "session_not_found", code: "P0001" }, en.session.notFound],
    [{ message: "not_staff", code: "42501" }, en.session.notStaff],
    // Same errcode as not_staff, but anonymous (player) sessions get their own message.
    [{ message: "not_organizer_account", code: "42501" }, en.auth.notOrganizerAccount],
    [{ message: "permission denied for function start_session", code: "42501" }, en.session.notStaff],
    [{ message: 'new row violates check constraint "sessions_courts_count_range"', code: "23514" }, en.club.invalidInput],
    [{ message: 'null value in column "name"', code: "23502" }, en.club.invalidInput],
    [{ message: "invalid input syntax for type timestamp", code: "22007" }, en.club.invalidInput],
    [{ message: "fetch failed" }, en.club.generic],
  ])("%j", (error, expected) => expect(sessionErrorMessage(error, en)).toBe(expected));
});
