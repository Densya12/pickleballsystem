import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SessionStatusLabel } from "./SessionStatusLabel";

describe("SessionStatusLabel", () => {
  it.each([
    ["draft", "Draft"],
    ["live", "Live ngayon"],
    ["ended", "Tapos na"],
  ] as const)("%s reads as %s, with a hidden icon", (status, label) => {
    const { container } = render(<SessionStatusLabel status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
