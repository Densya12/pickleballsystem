import { describe, expect, it } from "vitest";
import { AUTH_MESSAGES } from "@/lib/auth/messages";
import { SESSION_ERRORS } from "@/lib/session/messages";
import {
  calledBanner,
  finishedBanner,
  formatChangedBanner,
  needPlayersText,
  pausedBanner,
  QUEUE_ERRORS,
  queueErrorMessage,
  notReadyText,
  removedBanner,
  resumedBanner,
  swappedBanner,
  walkInBanner,
} from "./messages";

describe("banners (NF8)", () => {
  it("names who was called and where", () => {
    expect(calledBanner("Court 2", ["Ana", "Ben", "Carlo", "Dina"])).toBe("Tinawag sa Court 2: Ana, Ben, Carlo, Dina");
  });

  it("after a game in all off, names the next four", () => {
    expect(finishedBanner({ courtLabel: "Court 1", gameNumber: 3, next: ["Eli", "Fe", "Gil", "Hans"] })).toBe(
      "Tapos ang Laro #3 sa Court 1. Tinawag: Eli, Fe, Gil, Hans",
    );
  });

  it("in winners stay, names the winners too", () => {
    expect(
      finishedBanner({ courtLabel: "Court 1", gameNumber: 4, winners: ["Ana", "Ben"], next: ["Ana", "Ben", "Eli", "Fe"] }),
    ).toBe("Tapos ang Laro #4 sa Court 1. Panalo: Ana at Ben. Tinawag: Ana, Ben, Eli, Fe");
  });

  it("says when the court stays empty", () => {
    expect(finishedBanner({ courtLabel: "Court 2", gameNumber: 5, next: null })).toBe(
      "Tapos ang Laro #5 sa Court 2. Bakante muna ang Court 2; kulang pa ang nakapila.",
    );
  });

  it("walk-in, pause, resume and remove", () => {
    expect(walkInBanner("Tito Boy", 7)).toBe("Nasa pila na si Tito Boy (pang-7).");
    expect(walkInBanner("Tito Boy", null)).toBe("Nasa pila na si Tito Boy.");
    expect(pausedBanner("Ana")).toBe("Naka-pause si Ana. Hindi siya tatawagin hanggang ituloy.");
    expect(resumedBanner("Ana")).toBe("Tuloy na si Ana, sa dati niyang puwesto sa pila.");
    expect(removedBanner("Ana")).toBe("Inalis si Ana sa pila.");
    expect(needPlayersText(3)).toBe("Kailangan pa ng 3 player");
  });

  it("singles: 1 winner, and format changes", () => {
    expect(finishedBanner({ courtLabel: "Court 2", gameNumber: 2, winners: ["Ana"], next: ["Ana", "Eli"] })).toBe(
      "Tapos ang Laro #2 sa Court 2. Panalo: Ana. Tinawag: Ana, Eli",
    );
    expect(formatChangedBanner("Court 2", "singles")).toBe("Singles na ang Court 2.");
    expect(formatChangedBanner("Court 1", "doubles")).toBe("Doubles na ang Court 1.");
    expect(queueErrorMessage({ message: "invalid_format", code: "P0001" })).toBe(QUEUE_ERRORS.invalidFormat);
  });

  it("BR19: not ready and swap", () => {
    expect(notReadyText("Ana")).toBe("Hindi pa handa si Ana");
    expect(swappedBanner("Ana", "Ben", "Court 1")).toBe("Pinalitan si Ana ni Ben sa Court 1. Nasa unahan na ng pila si Ana.");
    expect(queueErrorMessage({ message: "player_not_on_court", code: "P0001" })).toBe(QUEUE_ERRORS.notOnCourt);
  });
});

describe("queueErrorMessage", () => {
  it("uses the number still needed from the error detail", () => {
    expect(queueErrorMessage({ message: "not_enough_players", code: "P0001", details: "2" })).toBe(
      "Kailangan pa ng 2 player bago makatawag.",
    );
    expect(queueErrorMessage({ message: "not_enough_players", code: "P0001", details: null })).toBe(
      "Kulang pa ang nakapila para makatawag.",
    );
  });

  it.each([
    [{ message: "game_already_finished", code: "P0001" }, QUEUE_ERRORS.alreadyFinished],
    [{ message: "court_busy", code: "P0001" }, QUEUE_ERRORS.courtBusy],
    [{ message: "invalid_winners", code: "P0001" }, QUEUE_ERRORS.invalidWinners],
    [{ message: "invalid_player_status", code: "P0001" }, QUEUE_ERRORS.playerChanged],
    [{ message: "session_not_live", code: "P0001" }, QUEUE_ERRORS.notLive],
    [{ message: "court_not_found", code: "P0001" }, QUEUE_ERRORS.notFound],
    [{ message: "player_not_found", code: "P0001" }, QUEUE_ERRORS.notFound],
    [{ message: "not_organizer_account", code: "42501" }, AUTH_MESSAGES.notOrganizerAccount],
    [{ message: "session_not_found", code: "P0001" }, SESSION_ERRORS.notFound],
    [{ message: 'violates check constraint "session_players_display_name_length"', code: "23514" }, SESSION_ERRORS.invalidInput],
    [{ message: "fetch failed" }, SESSION_ERRORS.generic],
  ])("%j", (error, expected) => expect(queueErrorMessage(error)).toBe(expected));
});
