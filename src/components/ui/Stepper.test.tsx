import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Stepper } from "./Stepper";

function renderStepper(defaultValue = 2) {
  const { container } = render(
    <form>
      <Stepper label="Ilang court?" name="courts_count" min={1} max={8} defaultValue={defaultValue} formatValue={(n) => `${n} courts`} />
    </form>,
  );
  const hidden = () => container.querySelector<HTMLInputElement>('input[name="courts_count"]')!.value;
  return { hidden };
}

describe("Stepper", () => {
  it("is a labelled group with worded buttons and the value on screen", () => {
    const { hidden } = renderStepper();
    expect(screen.getByRole("group", { name: "Ilang court?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bawas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dagdag" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("2 courts");
    expect(hidden()).toBe("2");
  });

  it("steps up and down and sends the value with the form", async () => {
    const { hidden } = renderStepper();
    await userEvent.click(screen.getByRole("button", { name: "Dagdag" }));
    await userEvent.click(screen.getByRole("button", { name: "Dagdag" }));
    expect(hidden()).toBe("4");
    await userEvent.click(screen.getByRole("button", { name: "Bawas" }));
    expect(hidden()).toBe("3");
    expect(screen.getByRole("status")).toHaveTextContent("3 courts");
  });

  it("stops at the limits", async () => {
    renderStepper(1);
    expect(screen.getByRole("button", { name: "Bawas" })).toBeDisabled();
    render(<Stepper label="Max" name="m" min={1} max={8} defaultValue={8} />);
    expect(screen.getAllByRole("button", { name: "Dagdag" })[1]).toBeDisabled();
  });

  it("clamps an out-of-range default", () => {
    const { hidden } = renderStepper(20);
    expect(hidden()).toBe("8");
  });

  it("links an error to the group", () => {
    render(<Stepper label="Ilang court?" name="c" min={1} max={8} defaultValue={2} error="Pumili ng 1 hanggang 8 court." />);
    expect(screen.getByRole("group", { name: "Ilang court?" })).toHaveAccessibleDescription("Pumili ng 1 hanggang 8 court.");
  });
});
