import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("renders a <button> with type=button by default", () => {
    render(<Button>Join queue</Button>);
    const button = screen.getByRole("button", { name: "Join queue" });
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
  });

  it("renders a link when href is given", () => {
    render(<Button href="/design-system">View</Button>);
    const link = screen.getByRole("link", { name: "View" });
    expect(link).toHaveAttribute("href", "/design-system");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("supports the disabled state", () => {
    render(<Button disabled>Full</Button>);
    expect(screen.getByRole("button", { name: "Full" })).toBeDisabled();
  });

  it("main button: ink, 52px (D19), by default", () => {
    render(<Button fullWidth>Start session</Button>);
    expect(screen.getByRole("button", { name: "Start session" })).toHaveClass("bg-primary", "min-h-[52px]", "w-full");
  });

  it("lime pill for the key row action, 40px", () => {
    render(
      <Button variant="lime" size="pill">
        Done
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Done" })).toHaveClass("bg-accent", "min-h-10", "rounded-full");
  });

  it("36px buttons keep a 44px touch area", () => {
    render(
      <Button variant="outline" size="sm">
        Cash
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Cash" })).toHaveClass("touch-target", "min-h-9");
  });
});
