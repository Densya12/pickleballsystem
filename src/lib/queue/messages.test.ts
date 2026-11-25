import { describe, expect, it } from "vitest";
import { en, fil } from "@/lib/i18n/dictionary";
import { finishedBanner, queueErrorMessage, samePlayers } from "./messages";

/** Banners after each queue action (NF8), now in the dictionaries (D20). */
describe("queue banners", () => {
  it("names who was called, in English and Taglish", () => {
    expect(en.live.called("Court 2", ["Ana", "Ben", "Carlo", "Dina"])).toBe("Called to Court 2: Ana, Ben, Carlo, Dina");
    expect(fil.live.called("Court 2", ["Ana", "Ben", "Carlo", "Dina"])).toBe("Tinawag sa Court 2: Ana, Ben, Carlo, Dina");
  });

  it("finished: the game, the winners (winners stay) and who's next", () => {
    expect(en.live.finished({ courtLabel: "Court 1", gameNumber: 3, winners: ["Ana", "Ben"], next: ["Carlo", "Dina", "Ana", "Ben"] })).toBe(
      "Game #3 on Court 1 is done. Won: Ana and Ben. Called: Carlo, Dina, Ana, Ben",
    );
    expect(fil.live.finished({ courtLabel: "Court 1", gameNumber: 3, winners: ["Ana", "Ben"], next: ["Carlo", "Dina", "Ana", "Ben"] })).toBe(
      "Tapos ang Laro #3 sa Court 1. Panalo: Ana at Ben. Tinawag: Carlo, Dina, Ana, Ben",
    );
  });

  it("finished with nobody to call says the court stays empty", () => {
    expect(en.live.finished({ courtLabel: "Court 2", gameNumber: 1, next: null })).toBe(
      "Game #1 on Court 2 is done. Court 2 stays empty; not enough players waiting.",
    );
  });

  it("walk-in, pause, resume, remove, swap, format, undo", () => {
    expect(en.live.walkInAdded("Ana", 7)).toBe("Ana is in the queue (#7).");
    expect(en.live.walkInAdded("Ana", null)).toBe("Ana is in the queue.");
    expect(fil.live.walkInAdded("Ana", 7)).toBe("Nasa pila na si Ana (pang-7).");
    expect(en.live.paused("Ana")).toMatch(/paused/);
    expect(en.live.resumed("Ana")).toMatch(/back in their place/);
    expect(en.live.removed("Ana")).toBe("Ana was removed from the queue.");
    expect(en.live.swapped("Ana", "Ben", "Court 1")).toBe("Ben replaced Ana on Court 1. Ana is now first in the queue.");
    expect(en.live.formatChanged("Court 2", "Singles")).toBe("Court 2 is now singles.");
    expect(en.live.undoneFinish("Court 1", 3)).toBe("Game #3 on Court 1 is back on. Keep playing.");
  });
});

describe("finishedBanner (after Done)", () => {
  const base = { courtLabel: "Court 2", gameNumber: 1, finishedPlayerIds: ["a", "b"] };

  it("same two players called again (All off, nobody else waiting): says they play again", () => {
    const next = { playerIds: ["b", "a"], names: ["Bea", "Ana"] };
    expect(finishedBanner(en, { ...base, next })).toBe("Nobody else is waiting, so Bea and Ana play again on Court 2.");
    expect(finishedBanner(fil, { ...base, next })).toBe("Walang ibang naghihintay, kaya Bea at Ana ulit ang maglalaro sa Court 2.");
  });

  it("four players again in doubles: lists all four", () => {
    const next = { playerIds: ["d", "c", "b", "a"], names: ["Dina", "Carlo", "Ben", "Ana"] };
    expect(finishedBanner(en, { ...base, finishedPlayerIds: ["a", "b", "c", "d"], next })).toBe(
      "Nobody else is waiting, so Dina, Carlo, Ben, and Ana play again on Court 2.",
    );
  });

  it("anyone different: the normal banner (game, winners, who was called)", () => {
    const next = { playerIds: ["a", "c"], names: ["Ana", "Carlo"] };
    expect(finishedBanner(en, { ...base, winners: ["Ana"], next })).toBe(
      "Game #1 on Court 2 is done. Won: Ana. Called: Ana, Carlo",
    );
  });

  it("nobody called: the court stays empty", () => {
    expect(finishedBanner(en, { ...base, next: null })).toBe("Game #1 on Court 2 is done. Court 2 stays empty; not enough players waiting.");
  });

  it("samePlayers ignores order but not size", () => {
    expect(samePlayers(["a", "b"], ["b", "a"])).toBe(true);
    expect(samePlayers(["a", "b"], ["a", "b", "c"])).toBe(false);
    expect(samePlayers(["a", "b"], ["a", "c"])).toBe(false);
  });
});

describe("rotation while live", () => {
  it("the Courts line shows the rotation, and a change is confirmed", () => {
    expect(en.live.liveLine("All off", 4, 2)).toBe("Live · All off · 4 playing · 2 in queue");
    expect(fil.live.liveLine("Mananatili ang nanalo", 4, 2)).toBe("Live · Mananatili ang nanalo · 4 naglalaro · 2 nakapila");
    expect(en.live.rotationChanged("Winners stay")).toBe("After a game: Winners stay. It applies from the next Done.");
    expect(queueErrorMessage({ message: "invalid_rotation" }, en)).toBe("Pick what happens after a game.");
  });

  it("the court header shows the game number while playing", () => {
    expect(en.live.courtMeta("Singles", { number: 2, minutes: 0 })).toBe("Game 2 · 0 min");
    expect(fil.live.courtMeta("Singles", { number: 2, minutes: 5 })).toBe("Laro 2 · 5 min");
    expect(en.live.courtMeta("Doubles", null)).toBe("Doubles · Empty");
  });
});

describe("queueErrorMessage", () => {
  it("says how many more players are needed", () => {
    expect(queueErrorMessage({ message: "not_enough_players", details: "2" }, en)).toBe("Need 2 more players to call.");
    expect(queueErrorMessage({ message: "not_enough_players", details: "1" }, en)).toBe("Need 1 more player to call.");
    expect(queueErrorMessage({ message: "not_enough_players", details: "x" }, en)).toBe(en.live.notEnough);
    expect(queueErrorMessage({ message: "not_enough_players", details: "2" }, fil)).toBe("Kailangan pa ng 2 player bago makatawag.");
  });

  it.each([
    ["game_already_finished", en.live.alreadyFinished],
    ["court_busy", en.live.courtBusy],
    ["invalid_winners", en.live.invalidWinners],
    ["invalid_player_status", en.live.playerChanged],
    ["session_not_live", en.live.notLive],
    ["invalid_format", en.live.invalidFormat],
    ["player_not_on_court", en.live.notOnCourt],
    ["undo_not_available", en.live.undoNotAvailable],
    ["court_not_found", en.live.notFound],
    ["already_paid", en.payments.alreadyPaid],
    ["not_organizer_account", en.auth.notOrganizerAccount],
  ])("%s", (message, expected) => expect(queueErrorMessage({ message }, en)).toBe(expected));

  it("falls back to the session messages", () => {
    expect(queueErrorMessage({ message: "session_not_found" }, en)).toBe(en.session.notFound);
  });
});

describe("QA-09: swap refused when the player didn't flag not ready", () => {
  it("explains in both languages, and the outbox doesn't count it as done", async () => {
    expect(queueErrorMessage({ message: "player_not_flagged" }, en)).toBe(en.live.notFlagged);
    expect(queueErrorMessage({ message: "player_not_flagged" }, fil)).toBe(fil.live.notFlagged);
    const { isAlreadyDone } = await import("@/lib/outbox/rules");
    expect(isAlreadyDone("swap_not_ready", "player_not_flagged")).toBe(false);
  });
});
