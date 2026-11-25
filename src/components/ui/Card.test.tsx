import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card } from "./Card";

describe("Card", () => {
  it("is a white rounded card with no border (D19) and keeps extra classes", () => {
    render(
      <Card className="gap-3" data-testid="card">
        Court 1
      </Card>,
    );
    const card = screen.getByTestId("card");
    expect(card).toHaveTextContent("Court 1");
    expect(card).toHaveClass("bg-surface", "rounded-card", "p-4", "gap-3");
    expect(card.className).not.toMatch(/\bborder\b/);
  });

  it("can drop its padding for row layouts", () => {
    render(
      <Card padding="none" data-testid="rows">
        rows
      </Card>,
    );
    expect(screen.getByTestId("rows")).not.toHaveClass("p-4");
  });
});
