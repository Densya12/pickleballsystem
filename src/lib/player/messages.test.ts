import { describe, expect, it } from "vitest";
import { en, fil } from "@/lib/i18n/dictionary";
import { playerErrorMessage } from "./messages";

describe("player messages", () => {
  it.each([
    [{ message: "checkin_closed", code: "P0001" }, "Check-in is closed."],
    [{ message: "session_not_found", code: "P0001" }, en.player.notFound],
    [{ message: "session_not_live", code: "P0001" }, en.player.ended],
    [{ message: "invalid_player_status", code: "P0001" }, en.player.changed],
    [{ message: "player_not_staying", code: "P0001" }, en.player.changed],
    [{ message: "player_not_found", code: "P0001" }, en.player.noRow],
    [{ message: "violates check constraint", code: "23514" }, en.player.invalidInput],
    // A failed fetch says so plainly.
    [{ message: "fetch failed" }, en.live.network],
    [{ message: "TypeError: Failed to fetch" }, en.live.network],
    [{ message: "something unexpected" }, en.common.genericError],
  ])("%j", (error, expected) => expect(playerErrorMessage(error, en)).toBe(expected));

  it("speaks Taglish when chosen", () => {
    expect(playerErrorMessage({ message: "checkin_closed" }, fil)).toBe("Sarado na ang check-in.");
  });

  it("shows how many wait and how many courts", () => {
    expect(en.player.checkInEyebrow(7, en.common.courts(2))).toBe("7 in queue · 2 courts");
    expect(fil.player.checkInEyebrow(0, fil.common.courts(1))).toBe("0 ang nakapila · 1 court");
  });
});
