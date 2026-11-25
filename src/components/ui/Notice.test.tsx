import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Notice } from "./Notice";

describe("Notice", () => {
  it("announces success politely with an aria-hidden icon", () => {
    const { container } = render(<Notice kind="success">Saved.</Notice>);
    expect(screen.getByRole("status")).toHaveTextContent("Saved.");
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("announces errors as alerts", () => {
    render(<Notice kind="error">{"Something's wrong."}</Notice>);
    expect(screen.getByRole("alert")).toHaveTextContent("Something's wrong.");
  });

  it("warnings are polite status messages", () => {
    render(<Notice kind="warning">Offline</Notice>);
    expect(screen.getByRole("status")).toHaveTextContent("Offline");
  });

  it("info is not a live region", () => {
    render(<Notice kind="info">Only the club owner can change this.</Notice>);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
