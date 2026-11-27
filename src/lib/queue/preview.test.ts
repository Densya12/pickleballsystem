import { describe, expect, it } from "vitest";
import { en, fil } from "@/lib/i18n/dictionary";
import { courtsLineup } from "@/lib/player/courts";
import { queueInfo } from "@/lib/player/state";
import { bandText, courtPreview, explainCall, nextPreview, noGroupText, parsePreview, playerBand, predictedIds, readyToCall, type QueuePreview } from "./preview";

const preview: QueuePreview = {
  preset: "mixed",
  formats: {
    doubles: { status: "ok", group: [{ id: "a", name: "Ana", skill: 3 }, { id: "c", name: "Cy", skill: 2 }, { id: "d", name: "Dee", skill: 3 }, { id: "f", name: "Fe", skill: 3 }], lo: 2, hi: 3 },
    singles: { status: "no_group", group: [], lo: 2, hi: 4 },
  },
};

describe("D25 previews and call notes (presentation only)", () => {
  it("explains a call: levels and variety; Fair line and old games unchanged", () => {
    expect(explainCall(en, { preset: "mixed", lo: 2, hi: 4, repeats: 0 })).toBe(" · levels 2–4 · haven't played together");
    expect(explainCall(en, { preset: "same_level", lo: 3, hi: 3, repeats: 1 })).toBe(" · level 3 · some played together recently");
    expect(explainCall(en, { preset: "same_level", lo: 1, hi: 5, mixed_call: true })).toBe(" · mixed levels · levels 1–5");
    expect(explainCall(en, { preset: "mixed", repeats: 0 })).toBe(" · haven't played together");
    expect(explainCall(en, { preset: "fair_line" })).toBe("");
    expect(explainCall(en, null)).toBe("");
    expect(explainCall(fil, { preset: "mixed", lo: 2, hi: 4, repeats: 0 })).toBe(" · level 2–4 · hindi pa nagkakasama");
  });

  it("picks the next court's preview: doubles if any court is doubles", () => {
    expect(nextPreview(preview, ["doubles", "singles"])?.status).toBe("ok");
    expect(nextPreview(preview, ["singles"])?.status).toBe("no_group");
    expect(nextPreview(null, ["doubles"])).toBeNull();
    expect(predictedIds(preview, ["doubles"])).toEqual(["a", "c", "d", "f"]);
    expect(predictedIds(preview, ["singles"])).toEqual([]);
    expect(predictedIds(null, ["doubles"])).toBeNull();
  });

  it("no group: 'No level 2–4 group yet'", () => {
    expect(noGroupText(en, preview.formats.singles!)).toBe("No level 2–4 group yet");
    expect(noGroupText(en, { status: "no_group", group: [] })).toBe("No group fits the levels yet");
  });

  it("a player's band: Mixed +-1, Same level equal, none for Fair line or no level", () => {
    expect(playerBand("mixed", 3)).toEqual([2, 4]);
    expect(playerBand("mixed", 1)).toEqual([1, 2]);
    expect(playerBand("same_level", 4)).toEqual([4, 4]);
    expect(playerBand("fair_line", 3)).toBeNull();
    expect(playerBand("mixed", null)).toBeNull();
    expect(bandText(en, 2, 4)).toBe("levels 2–4");
    expect(en.player.passedOverBand(en.player.ordinal(2), en.levels.groupBand(2, 4))).toBe("You're 2nd in line. Waiting for a level 2–4 group.");
    expect(fil.player.passedOverBand(fil.player.ordinal(2), fil.levels.groupBand(4, 5))).toBe("Pang-2 ka sa pila. Hinihintay ang grupong level 4–5.");
    expect(en.live.waitingBand(en.levels.groupBand(4, 5))).toBe("Waiting for a level 4–5 group");
    expect(fil.live.waitingBand(fil.levels.groupBand(3, 3))).toBe("Hinihintay ang grupong level 3");
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(en.player.ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd"]);
  });

  it("the line keeps queue order: the server's group is tagged Next in place, players passed over stay put", () => {
    const players = ["a", "b", "c", "d", "e", "f", "g"].map((id, i) => ({ id, name: id, status: "queued", queuePos: i + 1 }));
    const lineup = courtsLineup(players, ["doubles"], { payFirst: false, fee: 0 }, Infinity, ["a", "c", "d", "f"]);
    expect(lineup.ready.map((p) => [p.id, p.place, p.next, p.passedOver])).toEqual([
      ["a", 1, true, false],
      ["b", 2, false, true],
      ["c", 3, true, false],
      ["d", 4, true, false],
      ["e", 5, false, true],
      ["f", 6, true, false],
    ]);
    expect(lineup.after.map((p) => [p.id, p.place, p.next, p.passedOver])).toEqual([["g", 7, false, false]]);
    expect(queueInfo(players, "b", 4, undefined, ["a", "c", "d", "f"])).toMatchObject({ position: 2, nextUp: false, passedOver: true });
    expect(queueInfo(players, "f", 4, undefined, ["a", "c", "d", "f"])).toMatchObject({ position: 6, nextUp: true, passedOver: false });
    expect(queueInfo(players, "g", 4, undefined, ["a", "c", "d", "f"])).toMatchObject({ position: 7, nextUp: false, passedOver: false });
    // No group fits: nobody is "next"; the front of the line waits for a group, in place.
    const none = courtsLineup(players, ["doubles"], { payFirst: false, fee: 0 }, Infinity, []);
    expect(none.ready.map((p) => [p.id, p.next, p.passedOver])).toEqual([
      ["a", false, true],
      ["b", false, true],
      ["c", false, true],
      ["d", false, true],
    ]);
    expect(queueInfo(players, "e", 4, undefined, [])).toMatchObject({ nextUp: false, passedOver: false });
    // Unknown or not enough players (null): the first 4 in queue order, nobody passed over.
    const unknown = courtsLineup(players, ["doubles"], { payFirst: false, fee: 0 }, Infinity, null);
    expect(unknown.ready.map((p) => [p.id, p.next, p.passedOver])).toEqual([
      ["a", true, false],
      ["b", true, false],
      ["c", true, false],
      ["d", true, false],
    ]);
    expect(parsePreview({ preset: "mixed" })).toEqual({ preset: "mixed", formats: {}, courts: {} });
    expect(parsePreview(null)).toBeNull();
  });

  it("D26: a court with staying winners uses its own preview; Ready to call after 2 minutes with a group", () => {
    const withCourt: QueuePreview = { ...preview, courts: { c9: { status: "ok", group: [{ id: "x", name: "X", skill: 3 }, { id: "y", name: "Y", skill: 3 }] } } };
    expect(courtPreview(withCourt, { id: "c9", format: "doubles", staying: ["a", "b"] })?.group).toHaveLength(2);
    expect(courtPreview(withCourt, { id: "c9", format: "doubles", staying: [] })?.group).toHaveLength(4);
    expect(courtPreview(null, { id: "c9", format: "doubles" })).toBeNull();
    const now = Date.parse("2026-11-27T10:00:00Z");
    const ok = withCourt.formats.doubles!;
    expect(readyToCall("2026-11-27T09:57:59Z", ok, now)).toBe(true);
    expect(readyToCall("2026-11-27T09:58:30Z", ok, now)).toBe(false);
    expect(readyToCall(null, ok, now)).toBe(false);
    expect(readyToCall("2026-11-27T09:50:00Z", withCourt.formats.singles!, now)).toBe(false);
  });
});
