import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BackLink } from "./BackLink";

describe("BackLink", () => {
  it("names where it goes back to (‹ Home) and is at least 44px tall", () => {
    render(<BackLink href="/" label="Home" />);
    const link = screen.getByRole("link", { name: "Home" });
    expect(link).toHaveAttribute("href", "/");
    expect(link).toHaveClass("min-h-11");
  });
});
