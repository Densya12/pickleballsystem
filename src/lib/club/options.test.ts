import { describe, expect, it } from "vitest";
import { en, fil } from "@/lib/i18n/dictionary";
import { allOffDescription, callModeChoices, callModeLabel, matchmakingChoices, matchmakingLabel, rotationChoices } from "./options";

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

describe("D25: who plays together", () => {
  it("Same level carries a note that courts may wait; the others don't", () => {
    const [mixed, balanced, same, fair] = matchmakingChoices(en);
    expect(balanced.note).toBeUndefined();
    expect(same.note).toBe("Courts may wait for a same-level group. Mixed works best for most sessions.");
    expect(mixed.note).toBeUndefined();
    expect(fair.note).toBeUndefined();
  });

  it("in Taglish too", () => {
    const same = matchmakingChoices(fil).find((choice) => choice.value === "same_level");
    expect(same?.note).toBe(
      "Puwedeng maghintay ang court hanggang may grupong pareho ang level. Mas bagay ang Halo-halo sa karamihan ng session.",
    );
  });
});

describe("D29: Balanced teams", () => {
  it("comes right after Mixed, with its description, in English and Taglish", () => {
    expect(matchmakingChoices(en).map((c) => c.value)).toEqual(["mixed", "balanced", "same_level", "fair_line"]);
    const en2 = matchmakingChoices(en)[1];
    expect([en2.label, en2.description]).toEqual(["Balanced teams", "Levels can mix. Teams are made even."]);
    const fil2 = matchmakingChoices(fil)[1];
    expect([fil2.label, fil2.description]).toEqual(["Pantay na teams", "Puwedeng magkahalo ang level. Pinapantay ang dalawang team."]);
    expect(matchmakingLabel("balanced", en)).toBe("Balanced teams");
  });
});

describe("D26: the Next game setting", () => {
  it("Wait for me first, then Call next automatically, in English and Taglish", () => {
    expect(callModeChoices(en).map((c) => [c.value, c.label])).toEqual([
      ["wait", "Wait for me"],
      ["auto_call", "Call next automatically"],
    ]);
    expect(callModeLabel("wait", fil)).toBe("Hintayin ako");
    expect(callModeLabel("auto_call", fil)).toBe("Kusang tawagin ang susunod");
  });
});
