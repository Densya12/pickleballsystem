import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("renders a <button> with type=button by default", () => {
    render(<Button>Sumali sa pila</Button>);
    const button = screen.getByRole("button", { name: "Sumali sa pila" });
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
  });

  it("renders a link when href is given", () => {
    render(<Button href="/design-system">Tingnan</Button>);
    const link = screen.getByRole("link", { name: "Tingnan" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/design-system");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("supports the disabled state", () => {
    render(<Button disabled>Puno na</Button>);
    expect(screen.getByRole("button", { name: "Puno na" })).toBeDisabled();
  });

  it("applies size, variant and fullWidth classes", () => {
    render(
      <Button size="lg" variant="accent" fullWidth>
        Simulan
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Simulan" });
    expect(button).toHaveClass("min-h-14", "bg-accent", "w-full");
  });

  it("uses the 48px md size by default", () => {
    render(<Button>Sige</Button>);
    expect(screen.getByRole("button", { name: "Sige" })).toHaveClass("min-h-12");
  });
});
