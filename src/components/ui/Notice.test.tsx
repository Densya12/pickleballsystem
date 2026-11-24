import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Notice } from "./Notice";

describe("Notice", () => {
  it("announces success politely with an aria-hidden icon", () => {
    const { container } = render(<Notice kind="success">Na-save na.</Notice>);
    expect(screen.getByRole("status")).toHaveTextContent("Na-save na.");
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("announces errors as alerts", () => {
    render(<Notice kind="error">May mali.</Notice>);
    expect(screen.getByRole("alert")).toHaveTextContent("May mali.");
  });

  it("info is not a live region", () => {
    render(<Notice kind="info">Ang owner lang ang pwedeng magbago nito.</Notice>);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Ang owner lang ang pwedeng magbago nito.")).toBeVisible();
  });
});
