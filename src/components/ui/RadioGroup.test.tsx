import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { RadioGroup } from "./RadioGroup";

const options = [
  { value: "11", label: "11" },
  { value: "15", label: "15" },
  { value: "21", label: "21" },
] as const;

describe("RadioGroup", () => {
  it("is a labelled group of native radios with the default checked", () => {
    render(<RadioGroup legend="Points bawat laro" name="points" options={options} defaultValue="15" />);
    const group = screen.getByRole("group", { name: "Points bawat laro" });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("radio", { name: "15" })).toBeChecked();
  });

  it("selects by tapping the label card", async () => {
    render(<RadioGroup legend="Points" name="points" options={options} defaultValue="11" />);
    await userEvent.click(screen.getByText("21"));
    expect(screen.getByRole("radio", { name: "21" })).toBeChecked();
  });

  it("links the error text and disables every option when disabled", () => {
    render(<RadioGroup legend="Points" name="p" options={options} error="Pumili ng isa." disabled />);
    expect(screen.getByRole("group", { name: "Points" })).toHaveAccessibleDescription("Pumili ng isa.");
    for (const radio of screen.getAllByRole("radio")) expect(radio).toBeDisabled();
  });

  it("shows option descriptions", () => {
    render(
      <RadioGroup
        legend="Rotation"
        name="r"
        options={[{ value: "all_off", label: "Lahat ng apat aalis", description: "Babalik sa pila." }]}
      />,
    );
    expect(screen.getByText("Babalik sa pila.")).toBeInTheDocument();
  });
});
