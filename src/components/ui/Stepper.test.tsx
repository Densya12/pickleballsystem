import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Stepper } from "./Stepper";

const labels = { decrementLabel: "Fewer courts", incrementLabel: "More courts" };

describe("Stepper", () => {
  it("steps within min and max with labelled round buttons", async () => {
    render(<Stepper label="Courts" name="courts" min={1} max={3} defaultValue={2} formatValue={(n) => `${n} courts`} {...labels} />);
    expect(screen.getByRole("group", { name: "Courts" })).toBeInTheDocument();
    expect(screen.getByText("2 courts")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "More courts" }));
    expect(screen.getByText("3 courts")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More courts" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Fewer courts" }));
    await userEvent.click(screen.getByRole("button", { name: "Fewer courts" }));
    expect(screen.getByText("1 courts")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fewer courts" })).toBeDisabled();
  });

  it("carries the value in a hidden input", async () => {
    const { container } = render(
      <form>
        <Stepper label="Courts" name="courts" min={1} max={8} defaultValue={2} {...labels} />
      </form>,
    );
    await userEvent.click(screen.getByRole("button", { name: "More courts" }));
    expect(new FormData(container.querySelector("form")!).get("courts")).toBe("3");
  });

  it("links an error to the group", () => {
    render(<Stepper label="Courts" name="courts" min={1} max={8} defaultValue={2} error="Pick 1 to 8 courts." {...labels} />);
    expect(screen.getByRole("group", { name: "Courts" })).toHaveAccessibleDescription("Pick 1 to 8 courts.");
  });
});
