import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageShell } from "./PageShell";

describe("PageShell", () => {
  it("renders the top row, a large title, content and the main button", () => {
    render(
      <PageShell top={<span>Home</span>} eyebrow="Biyernes Night" title="Courts" subtitle="Live" footer={<button type="button">Start</button>}>
        <p>Content</p>
      </PageShell>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Courts" })).toBeInTheDocument();
    expect(screen.getByText("Biyernes Night")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("Content");
    expect(screen.getByRole("contentinfo")).toHaveTextContent("Start");
  });

  it("pads the content so nothing hides behind a tab bar", () => {
    render(
      <PageShell tabBar={<nav aria-label="Main menu" />}>
        <p>Content</p>
      </PageShell>,
    );
    expect(screen.getByRole("main").className).toMatch(/pb-\[calc\(7rem\+env\(safe-area-inset-bottom\)\)\]/);
    expect(screen.getByRole("navigation", { name: "Main menu" })).toBeInTheDocument();
  });
});
