import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "./Input";

describe("Input", () => {
  it("is labelled by a visible label", () => {
    render(<Input label="Pangalan mo" />);
    expect(screen.getByLabelText("Pangalan mo")).toBeInTheDocument();
    expect(screen.getByText("Pangalan mo").tagName).toBe("LABEL");
  });

  it("links the hint via aria-describedby", () => {
    render(<Input label="Mobile number" hint="Para ma-text ka." />);
    expect(screen.getByLabelText("Mobile number")).toHaveAccessibleDescription("Para ma-text ka.");
  });

  it("links the error via aria-describedby and marks the field invalid", () => {
    render(<Input id="nick" label="Palayaw" hint="Ito ang tatawagin." error="Pakilagay ang palayaw mo." />);
    const input = screen.getByLabelText("Palayaw");

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "nick-hint nick-error");
    expect(input).toHaveAccessibleDescription("Ito ang tatawagin. Pakilagay ang palayaw mo.");
  });

  it("is not marked invalid without an error", () => {
    render(<Input label="Club" />);
    const input = screen.getByLabelText("Club");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
  });
});
