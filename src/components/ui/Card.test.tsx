import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card } from "./Card";

describe("Card", () => {
  it("renders children with surface styles and keeps extra classes", () => {
    render(
      <Card className="gap-3" data-testid="card">
        Court 1
      </Card>,
    );
    const card = screen.getByTestId("card");
    expect(card).toHaveTextContent("Court 1");
    expect(card).toHaveClass("bg-surface", "rounded-card", "shadow-card", "border-default", "gap-3");
  });
});

describe("Card padding", () => {
  it("can drop its padding for row layouts", () => {
    render(
      <Card padding="none" data-testid="rows">
        rows
      </Card>,
    );
    expect(screen.getByTestId("rows")).not.toHaveClass("p-5");
  });
});
