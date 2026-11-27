import { describe, expect, it } from "vitest";
import { partnerOf, sideOf, teamsOf, winnersFor } from "./winners";

const four = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];

describe("teams (D25)", () => {
  it("doubles: positions 1-2 are the left team, 3-4 the right", () => {
    expect(teamsOf(four, "doubles")).toEqual([[{ id: "a" }, { id: "b" }], [{ id: "c" }, { id: "d" }]]);
    expect([0, 1, 2, 3].map((i) => sideOf(i, "doubles"))).toEqual([0, 0, 1, 1]);
  });

  it("singles: 1 vs 2", () => {
    expect(teamsOf(four.slice(0, 2), "singles")).toEqual([[{ id: "a" }], [{ id: "b" }]]);
    expect([0, 1].map((i) => sideOf(i, "singles"))).toEqual([0, 1]);
  });

  it("finds the partner on the same side (doubles only)", () => {
    expect(partnerOf(four, "a", "doubles")?.id).toBe("b");
    expect(partnerOf(four, "b", "doubles")?.id).toBe("a");
    expect(partnerOf(four, "c", "doubles")?.id).toBe("d");
    expect(partnerOf(four, "d", "doubles")?.id).toBe("c");
    expect(partnerOf(four.slice(0, 2), "a", "singles")).toBeNull();
    expect(partnerOf(four, "zz", "doubles")).toBeNull();
  });

  it("winners: a side's players (2 in doubles, 1 in singles)", () => {
    expect(winnersFor("doubles")).toBe(2);
    expect(winnersFor("singles")).toBe(1);
  });
});
