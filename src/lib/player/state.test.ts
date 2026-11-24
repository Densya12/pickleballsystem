import { describe, expect, it } from "vitest";
import { isCallable, pickPwestoState, queueInfo, type QueuePlayer, type RunningGame } from "./state";

const q = (id: string, status: string, queuePos: number): QueuePlayer => ({ id, name: id.toUpperCase(), status, queuePos });

describe("queueInfo (BR5 order, next 4 eligible)", () => {
  const players = [q("a", "queued", 1), q("b", "paused", 2), q("c", "queued", 3), q("d", "queued", 4), q("e", "queued", 5), q("me", "queued", 6), q("x", "playing", 0)];

  it("counts everyone waiting (queued and paused) for #N", () => {
    expect(queueInfo(players, "me")?.position).toBe(6);
    expect(queueInfo(players, "a")?.position).toBe(1);
  });

  it("is 'next up' when fewer than 4 eligible are ahead (paused ones don't count)", () => {
    // Ahead: a, c, d, e are eligible (4) -> not next up.
    expect(queueInfo(players, "me")?.nextUp).toBe(false);
    // e: a, c, d ahead (3 eligible; b is paused) -> next up.
    expect(queueInfo(players, "e")?.nextUp).toBe(true);
  });

  it("a paused player is never 'next up'", () => {
    expect(queueInfo(players, "b")?.nextUp).toBe(false);
  });

  it("lists up to 3 names right before the player", () => {
    expect(queueInfo(players, "me")?.ahead).toEqual(["C", "D", "E"]);
    expect(queueInfo(players, "c")?.ahead).toEqual(["A", "B"]);
    expect(queueInfo(players, "a")?.ahead).toEqual([]);
  });

  it("sorts by queue_pos, not by list order", () => {
    const shuffled = [q("me", "queued", 9), q("z", "queued", 1)];
    expect(queueInfo(shuffled, "me")).toEqual({ position: 2, nextUp: true, ahead: ["Z"] });
  });

  it("returns null for someone not waiting", () => {
    expect(queueInfo(players, "x")).toBeNull();
    expect(isCallable({ status: "queued" })).toBe(true);
    expect(isCallable({ status: "paused" })).toBe(false);
  });
});

describe("pickPwestoState", () => {
  const players = [q("a", "playing", 0), q("b", "playing", 0), q("c", "playing", 0), q("me", "queued", 4), q("d", "queued", 3)];
  const games: RunningGame[] = [{ id: "g1", number: 1, courtLabel: "Court 2", playerIds: ["a", "b", "me", "c"] }];
  const me = (status: string, notReady = false) => ({ id: "me", name: "Me", status, notReady });

  it("queued", () => {
    expect(pickPwestoState({ sessionStatus: "live", me: me("queued"), players, games: [] })).toEqual({
      kind: "queued",
      position: 2,
      nextUp: true,
      ahead: ["D"],
    });
  });

  it("paused keeps the place number", () => {
    const paused = players.map((p) => (p.id === "me" ? { ...p, status: "paused" } : p));
    expect(pickPwestoState({ sessionStatus: "live", me: me("paused"), players: paused, games: [] })).toEqual({ kind: "paused", position: 2 });
  });

  it("called/playing: court and the other 3 names, in call order", () => {
    const playing = players.map((p) => (p.id === "me" ? { ...p, status: "playing" } : p));
    expect(pickPwestoState({ sessionStatus: "live", me: me("playing"), players: playing, games })).toEqual({
      kind: "playing",
      gameId: "g1",
      courtLabel: "Court 2",
      withNames: ["A", "B", "C"],
      notReady: false,
    });
    expect(pickPwestoState({ sessionStatus: "live", me: me("playing", true), players: playing, games })).toMatchObject({ notReady: true });
  });

  it("left and ended", () => {
    expect(pickPwestoState({ sessionStatus: "live", me: null, players, games })).toEqual({ kind: "left" });
    expect(pickPwestoState({ sessionStatus: "live", me: me("left"), players, games })).toEqual({ kind: "left" });
    expect(pickPwestoState({ sessionStatus: "ended", me: me("queued"), players, games })).toEqual({ kind: "ended" });
  });
});
