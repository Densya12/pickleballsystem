import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BackLink } from "./BackLink";

describe("BackLink", () => {
  it('renders a link named "Bumalik" with an aria-hidden chevron', () => {
    const { container } = render(<BackLink href="/" />);
    const link = screen.getByRole("link", { name: "Bumalik" });
    expect(link).toHaveAttribute("href", "/");
    expect(link).toHaveClass("min-h-12");
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
