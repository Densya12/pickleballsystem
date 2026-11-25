import { describe, expect, it } from "vitest";
import { en, fil } from "@/lib/i18n/dictionary";
import { allOffDescription, rotationChoices } from "./options";

describe("QA-13: 'All off' says who leaves, by the courts' formats", () => {
  it("doubles: All four; singles: Both; mixed or unknown: Everyone on court", () => {
    expect(allOffDescription(en, ["doubles", "doubles"])).toBe("All four go to the back of the queue");
    expect(allOffDescription(en, ["singles"])).toBe("Both go to the back of the queue");
    expect(allOffDescription(en, ["doubles", "singles"])).toBe("Everyone on court goes to the back of the queue");
    expect(allOffDescription(en)).toBe("Everyone on court goes to the back of the queue");
    expect(allOffDescription(en, [])).toBe("Everyone on court goes to the back of the queue");
  });

  it("in Taglish too", () => {
    expect(allOffDescription(fil, ["doubles"])).toBe("Babalik ang apat sa dulo ng pila");
    expect(allOffDescription(fil, ["singles", "singles"])).toBe("Babalik ang dalawa sa dulo ng pila");
    expect(allOffDescription(fil, ["singles", "doubles"])).toBe("Babalik lahat ng nasa court sa dulo ng pila");
  });

  it("rotationChoices uses it for the All off choice only", () => {
    const [allOff, winners] = rotationChoices(en, ["singles"]);
    expect(allOff).toEqual({ value: "all_off", label: "All off", description: "Both go to the back of the queue" });
    expect(winners.value).toBe("winners_stay");
    expect(winners.description).toBe(en.choices.winnersStayDescription);
  });
});
