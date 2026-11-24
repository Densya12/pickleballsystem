import { describe, expect, it } from "vitest";
import { NETWORK_ERROR_MESSAGE } from "@/lib/outbox/rules";
import { PLAYER_ERRORS, playerErrorMessage, waitingLine } from "./messages";

describe("player messages", () => {
  it.each([
    [{ message: "checkin_closed", code: "P0001" }, "Sarado na ang check-in."],
    [{ message: "session_not_found", code: "P0001" }, PLAYER_ERRORS.notFound],
    [{ message: "session_not_live", code: "P0001" }, PLAYER_ERRORS.ended],
    [{ message: "invalid_player_status", code: "P0001" }, PLAYER_ERRORS.changed],
    [{ message: "player_not_found", code: "P0001" }, PLAYER_ERRORS.noRow],
    [{ message: "violates check constraint", code: "23514" }, PLAYER_ERRORS.invalidInput],
    // Phase 7: a failed fetch says so plainly.
    [{ message: "fetch failed" }, NETWORK_ERROR_MESSAGE],
    [{ message: "TypeError: Failed to fetch" }, NETWORK_ERROR_MESSAGE],
    [{ message: "something unexpected" }, PLAYER_ERRORS.generic],
  ])("%j", (error, expected) => expect(playerErrorMessage(error)).toBe(expected));

  it("shows how many wait and how many courts", () => {
    expect(waitingLine(7, 2)).toBe("7 ang nakapila · 2 courts");
    expect(waitingLine(0, 1)).toBe("0 ang nakapila · 1 court");
  });
});

