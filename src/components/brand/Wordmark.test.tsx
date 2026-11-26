import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandMark } from "./BrandMark";
import { Wordmark } from "./Wordmark";

describe("Wordmark (D21)", () => {
  it("is read as 'Pilaball'; the letters and the ball are hidden", () => {
    render(
      <h1>
        <Wordmark />
      </h1>,
    );
    expect(screen.getByRole("img", { name: "Pilaball" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pilaball" })).toBeInTheDocument();
    const ball = document.querySelector("[data-wordmark-ball]")!;
    expect(ball).toHaveAttribute("aria-hidden", "true");
    expect(ball.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it("spells pılaball with a dotless ı (U+0131), the ball sized in em", () => {
    render(<Wordmark size={40} />);
    const mark = screen.getByRole("img", { name: "Pilaball" });
    expect(mark.textContent).toBe("pılaball");
    expect(mark).toHaveStyle({ fontSize: "40px" });
    const ball = document.querySelector<SVGElement>("[data-wordmark-ball]")!;
    expect(ball.style.width).toBe("0.36em");
    // At 40px the ball is 0.36em = 14.4px, as in N-Logo (14px at 40px).
    expect(ball).toHaveStyle({ width: "14.4px", height: "14.4px" });
  });

  it("uses the outlined ball on light backgrounds and the plain ball on ink", () => {
    const { rerender } = render(<Wordmark />);
    expect(document.querySelector("[data-wordmark-ball] circle")).toHaveAttribute("stroke", "#111412");
    rerender(<Wordmark tone="dark" />);
    expect(document.querySelector("[data-wordmark-ball] circle")).not.toHaveAttribute("stroke");
    expect(screen.getByRole("img", { name: "Pilaball" })).toHaveAttribute("data-wordmark", "dark");
  });
});

describe("BrandMark", () => {
  it("is decorative by default and named when given a label", () => {
    const { container, rerender } = render(<BrandMark size={48} />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("svg")).toHaveAttribute("width", "48");
    rerender(<BrandMark label="Pilaball" />);
    expect(screen.getByRole("img", { name: "Pilaball" })).toBeInTheDocument();
  });
});
