import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusLabel, type StatusKind } from "./StatusLabel";

const cases: [StatusKind, string][] = [
  ["paid", "Bayad"],
  ["pending", "I-check"],
  ["hold", "Hold · bayad muna"],
  ["playing", "Naglalaro"],
];

describe("StatusLabel", () => {
  it.each(cases)("%s shows its text and an aria-hidden icon", (kind, text) => {
    const { container } = render(<StatusLabel kind={kind} />);
    expect(screen.getByText(text)).toBeVisible();

    const icon = container.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });
});
