import { describe, expect, it } from "vitest";
import { en, fil } from "@/lib/i18n/dictionary";
import { courtsLineup } from "@/lib/player/courts";
import { queueInfo } from "@/lib/player/state";
import { bandText, explainCall, nextPreview, noGroupText, parsePreview, playerBand, predictedIds, type QueuePreview } from "./preview";

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
    expect(en.player.upWhenBand(en.levels.groupBand(2, 4), en.player.ordinal(2))).toBe("You're up when a level 2–4 group forms. You're 2nd in line.");
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(en.player.ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd"]);
  });

  it("the lineup and 'next group' follow the server's group, not queue order", () => {
    const players = ["a", "b", "c", "d", "e", "f"].map((id, i) => ({ id, name: id, status: "queued", queuePos: i + 1 }));
    const lineup = courtsLineup(players, ["doubles"], { payFirst: false, fee: 0 }, Infinity, ["a", "c", "d", "f"]);
    expect(lineup.ready.map((p) => p.id)).toEqual(["a", "c", "d", "f"]);
    expect(lineup.after.map((p) => p.id)).toEqual(["b", "e"]);
    expect(queueInfo(players, "b", 4, undefined, ["a", "c", "d", "f"])?.nextUp).toBe(false);
    expect(queueInfo(players, "f", 4, undefined, ["a", "c", "d", "f"])?.nextUp).toBe(true);
    // No group fits: nobody is "next".
    expect(courtsLineup(players, ["doubles"], { payFirst: false, fee: 0 }, Infinity, []).ready).toEqual([]);
    expect(parsePreview({ preset: "mixed" })).toEqual({ preset: "mixed", formats: {} });
    expect(parsePreview(null)).toBeNull();
  });
});
