import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { chipLabels, MiniCourt } from "./MiniCourt";

const four = [
  { id: "1", name: "Dino Reyes" },
  { id: "2", name: "Carlo Mendoza" },
  { id: "3", name: "Bong Santos" },
  { id: "4", name: "Fe Castillo", notReady: true },
];

describe("MiniCourt", () => {
  it("doubles: four chips in call order (1 top-left, 2 bottom-left, 3 top-right, 4 bottom-right)", () => {
    const { container } = render(<MiniCourt format="doubles" players={four} />);
    const chips = [...container.querySelectorAll("[data-chip]")] as HTMLElement[];
    expect(chips.map((c) => c.textContent)).toEqual(["Dino", "Carlo", "Bong", "Fe"]);
    expect(chips.map((c) => [c.style.left, c.style.top])).toEqual([
      ["17%", "25%"],
      ["17%", "75%"],
      ["83%", "25%"],
      ["83%", "75%"],
    ]);
    expect(chips[3]).toHaveAttribute("data-chip", "not-ready");
  });

  it("singles: one chip per side, centered", () => {
    const { container } = render(<MiniCourt format="singles" players={[{ id: "a", name: "Hector" }, { id: "b", name: "Ivy", highlight: true }]} />);
    const chips = [...container.querySelectorAll("[data-chip]")] as HTMLElement[];
    expect(chips).toHaveLength(2);
    expect(chips.map((c) => c.style.top)).toEqual(["50%", "50%"]);
    expect(chips[1]).toHaveAttribute("data-chip", "me");
  });

  it("draws the court (surface, kitchens, net) and is decorative", () => {
    const { container } = render(<MiniCourt format="doubles" players={[]} />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector('rect[fill="#24583D"]')).not.toBeNull();
    expect(container.querySelector('rect[x="150"][width="140"][fill="#2E6B4A"]')).not.toBeNull();
    expect(container.querySelector('path[d="M220 0V200"]')).toHaveAttribute("stroke-width", "5");
    expect(container.querySelectorAll("[data-chip]")).toHaveLength(0);
  });

  it("chip labels are first names, unless two clash", () => {
    expect(chipLabels(["Ana Lopez", "Ana Reyes", "Ben Cruz"])).toEqual(["Ana Lopez", "Ana Reyes", "Ben"]);
  });
});
