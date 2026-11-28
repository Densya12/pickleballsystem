import { describe, expect, it } from "vitest";
import { en, fil } from "@/lib/i18n/dictionary";
import { newestFirst, partnerChoices, winnersOf, winningSide, withPartner } from "./log";

const doubles = ["ana", "ben", "carl", "dan"];

describe("match log helpers (D27)", () => {
  it("which side won: left, right, or no result", () => {
    expect(winningSide(doubles, ["ben", "ana"], "doubles")).toBe(0);
    expect(winningSide(doubles, ["carl", "dan"], "doubles")).toBe(1);
    expect(winningSide(doubles, null, "doubles")).toBeNull();
    expect(winningSide(doubles, ["ana", "carl"], "doubles")).toBeNull();
    expect(winningSide(["ana", "ben"], ["ben"], "singles")).toBe(1);
  });

  it("the winners for a choice, in position order", () => {
    expect(winnersOf(doubles, 0, "doubles")).toEqual(["ana", "ben"]);
    expect(winnersOf(doubles, 1, "doubles")).toEqual(["carl", "dan"]);
    expect(winnersOf(doubles, null, "doubles")).toBeNull();
    expect(winnersOf(["ana", "ben"], 0, "singles")).toEqual(["ana"]);
  });

  it("Fix teams: Player 1's partner picks one of the 3 pairings; nobody added or removed", () => {
    expect(partnerChoices(doubles)).toEqual(["ben", "carl", "dan"]);
    expect(withPartner(doubles, "ben")).toEqual(["ana", "ben", "carl", "dan"]);
    expect(withPartner(doubles, "carl")).toEqual(["ana", "carl", "ben", "dan"]);
    expect(withPartner(doubles, "dan")).toEqual(["ana", "dan", "ben", "carl"]);
    expect(withPartner(doubles, "zed")).toEqual(doubles);
    expect(new Set(withPartner(doubles, "dan"))).toEqual(new Set(doubles));
  });

  it("newest game first", () => {
    expect(newestFirst([{ number: 1 }, { number: 3 }, { number: 2 }]).map((g) => g.number)).toEqual([3, 2, 1]);
  });
});

describe("Games & standings strings (English and Taglish)", () => {
  it("the log line, the sides and the result", () => {
    expect(en.games.gameLine(12, "Court 2", "7:41 PM")).toBe("Game 12 · Court 2 · 7:41 PM");
    expect(en.games.versus("Ana + Ben", "Carl + Dan")).toBe("Ana + Ben vs Carl + Dan");
    expect(en.games.won(["Ana", "Ben"])).toBe("Ana + Ben won");
    expect(fil.games.won(["Ana", "Ben"])).toBe("Panalo sina Ana + Ben");
    expect(fil.games.won(["Ana"])).toBe("Panalo si Ana");
    expect(en.games.noResult).toBe("No result");
  });

  it("the correction and standings texts", () => {
    expect(en.games.fixed).toBe("Fixed. This changes the record only. Courts and the queue stay as they are.");
    expect(en.games.standingsHint).toBe("Wins first. Games with no result don't count as a win or a loss.");
    expect(en.games.partnerOf("Ana")).toBe("Ana's partner");
    expect(fil.games.partnerOf("Ana")).toBe("Kakampi ni Ana");
  });
});
