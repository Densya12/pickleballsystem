import { beforeEach, describe, expect, it, vi } from "vitest";
import { isAlreadyDone, isNetworkError, isQueueable, replayOutbox, type OutboxItem, type SendResult } from "./rules";
import { addToOutbox, loadOutbox, removeFromOutbox } from "./store";

let n = 0;
function item(kind: OutboxItem["kind"], label: string = kind): OutboxItem {
  n += 1;
  return { id: `i${n}`, sessionId: "s1", kind, args: {}, label, createdAt: n };
}

describe("what can wait for signal", () => {
  it("queues the organizer's court, queue and payment actions", () => {
    for (const kind of ["call_next", "finish_game", "add_walk_in", "pause_player", "resume_player", "remove_player", "confirm_payment", "swap_not_ready", "set_court_format"]) {
      expect(isQueueable(kind)).toBe(true);
    }
  });
  it("never queues undo or ending the session", () => {
    expect(isQueueable("undo_last")).toBe(false);
    expect(isQueueable("end_session")).toBe(false);
  });
});

describe("already done", () => {
  it("treats each action's repeat error as success", () => {
    expect(isAlreadyDone("call_next", "court_busy")).toBe(true);
    expect(isAlreadyDone("finish_game", "game_already_finished")).toBe(true);
    expect(isAlreadyDone("confirm_payment", "already_paid")).toBe(true);
    expect(isAlreadyDone("pause_player", "invalid_player_status")).toBe(true);
    expect(isAlreadyDone("resume_player", "invalid_player_status")).toBe(true);
    expect(isAlreadyDone("remove_player", "invalid_player_status")).toBe(true);
    expect(isAlreadyDone("swap_not_ready", "player_not_on_court")).toBe(true);
  });
  it("but not real failures", () => {
    expect(isAlreadyDone("call_next", "not_enough_players")).toBe(false);
    expect(isAlreadyDone("finish_game", "court_busy")).toBe(false);
    expect(isAlreadyDone("set_court_format", "court_busy")).toBe(false);
    expect(isAlreadyDone("add_walk_in", "session_not_live")).toBe(false);
    // sit_out is idempotent itself; a winner called meanwhile is not "done" (Discard).
    expect(isQueueable("sit_out")).toBe(true);
    expect(isAlreadyDone("sit_out", "player_not_staying")).toBe(false);
    expect(isAlreadyDone("finish_game", undefined)).toBe(false);
  });
});

describe("replayOutbox", () => {
  it("sends in order and removes each one", async () => {
    const items = [item("finish_game", "1"), item("add_walk_in", "2"), item("call_next", "3")];
    const sent: string[] = [];
    const removed: string[] = [];
    const outcome = await replayOutbox(
      items,
      async (i) => {
        sent.push(i.label);
        return {};
      },
      (i) => removed.push(i.label),
    );
    expect(outcome).toEqual({ status: "done", sent: 3 });
    expect(sent).toEqual(["1", "2", "3"]);
    expect(removed).toEqual(["1", "2", "3"]);
  });

  it("an 'already done' error counts as sent", async () => {
    const results: SendResult[] = [{ error: "Tapos na.", code: "game_already_finished" }, {}];
    const removed: string[] = [];
    const outcome = await replayOutbox([item("finish_game"), item("pause_player")], async () => results.shift()!, (i) => removed.push(i.kind));
    expect(outcome.status).toBe("done");
    expect(removed).toEqual(["finish_game", "pause_player"]);
  });

  it("stops at a real error and keeps it and everything after", async () => {
    const items = [item("pause_player", "a"), item("call_next", "b"), item("finish_game", "c")];
    const send = vi.fn(async (i: OutboxItem): Promise<SendResult> =>
      i.label === "b" ? { error: "Kailangan pa ng 2 player bago makatawag.", code: "not_enough_players" } : {},
    );
    const removed: string[] = [];
    const outcome = await replayOutbox(items, send, (i) => removed.push(i.label));
    expect(outcome).toEqual({ status: "failed", sent: 1, item: items[1], message: "Kailangan pa ng 2 player bago makatawag." });
    expect(removed).toEqual(["a"]);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("QA-02: a Remove refused because the player is on court is NOT done: it stays, with its message", async () => {
    for (const kind of ["remove_player", "pause_player", "resume_player"] as const) {
      expect(isAlreadyDone(kind, "player_playing")).toBe(false);
    }
    const items = [item("remove_player", "Remove O5"), item("call_next", "Call Court 2")];
    const removed: string[] = [];
    const outcome = await replayOutbox(
      items,
      async (i) => (i.kind === "remove_player" ? { error: "O5 is on court now.", code: "player_playing" } : {}),
      (i) => removed.push(i.label),
    );
    expect(outcome).toEqual({ status: "failed", sent: 0, item: items[0], message: "O5 is on court now." });
    expect(removed).toEqual([]);
  });

  it("stops quietly when still offline (send throws)", async () => {
    const items = [item("finish_game", "a"), item("finish_game", "b")];
    const removed: string[] = [];
    const outcome = await replayOutbox(
      items,
      async () => {
        throw new TypeError("Failed to fetch");
      },
      (i) => removed.push(i.label),
    );
    expect(outcome).toEqual({ status: "offline", sent: 0 });
    expect(removed).toEqual([]);
  });
});

describe("isNetworkError", () => {
  it("recognizes failed fetches", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkError(new Error("NetworkError when attempting to fetch resource."))).toBe(true);
    expect(isNetworkError(new Error("Load failed"))).toBe(true);
    expect(isNetworkError(new Error("session_not_live"))).toBe(false);
  });
});

describe("outbox store", () => {
  beforeEach(() => window.localStorage.clear());

  it("keeps items in order, per session, across reads", () => {
    const a = item("finish_game");
    const b = { ...item("add_walk_in"), sessionId: "s2" };
    const c = item("call_next");
    addToOutbox(a);
    addToOutbox(b);
    addToOutbox(c);
    expect(loadOutbox("s1").map((i) => i.id)).toEqual([a.id, c.id]);
    expect(loadOutbox("s2").map((i) => i.id)).toEqual([b.id]);
    expect(loadOutbox("s1")).toBe(loadOutbox("s1")); // stable snapshot
    removeFromOutbox("s1", a.id);
    expect(loadOutbox("s1").map((i) => i.id)).toEqual([c.id]);
  });

  it("ignores broken storage", () => {
    window.localStorage.setItem("opq:outbox:s3", "{not json");
    expect(loadOutbox("s3")).toEqual([]);
  });
});
