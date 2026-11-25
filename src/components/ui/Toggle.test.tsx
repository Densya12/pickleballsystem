import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Toggle } from "./Toggle";

describe("Toggle", () => {
  it("is a switch named by its label and described by its hint", () => {
    render(<Toggle label="Pay before queueing" description="Unpaid players are skipped" name="pay_first" />);
    const toggle = screen.getByRole("switch", { name: "Pay before queueing" });
    expect(toggle).not.toBeChecked();
    expect(toggle).toHaveAccessibleDescription("Unpaid players are skipped");
  });

  it("toggles by tapping anywhere on the row and sends 'on' when checked", async () => {
    const { container } = render(
      <form>
        <Toggle label="Pay before queueing" description="Unpaid players are skipped" name="pay_first" />
      </form>,
    );
    const formEl = container.querySelector("form")!;
    expect(new FormData(formEl).get("pay_first")).toBeNull();
    await userEvent.click(screen.getByText("Unpaid players are skipped"));
    expect(screen.getByRole("switch")).toBeChecked();
    expect(new FormData(formEl).get("pay_first")).toBe("on");
  });

  it("can be controlled", async () => {
    const onChange = vi.fn();
    render(<Toggle label="Read calls aloud" checked={false} onCheckedChange={onChange} />);
    await userEvent.click(screen.getByRole("switch", { name: "Read calls aloud" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
