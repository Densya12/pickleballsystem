import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Toggle } from "./Toggle";

describe("Toggle", () => {
  it("is a switch named by its label and described by its hint", () => {
    render(<Toggle label="Bayad muna bago pumila" description="Lalaktawan ang hindi pa bayad" name="pay_first" />);
    const toggle = screen.getByRole("switch", { name: "Bayad muna bago pumila" });
    expect(toggle).not.toBeChecked();
    expect(toggle).toHaveAccessibleDescription("Lalaktawan ang hindi pa bayad");
  });

  it("toggles by tapping anywhere on the row and sends 'on' when checked", async () => {
    const { container } = render(
      <form>
        <Toggle label="Bayad muna bago pumila" description="Lalaktawan ang hindi pa bayad" name="pay_first" />
      </form>,
    );
    const formEl = container.querySelector("form")!;
    expect(new FormData(formEl).get("pay_first")).toBeNull();
    await userEvent.click(screen.getByText("Lalaktawan ang hindi pa bayad"));
    expect(screen.getByRole("switch")).toBeChecked();
    expect(new FormData(formEl).get("pay_first")).toBe("on");
  });

  it("writes the state out in words, not only by color", () => {
    render(<Toggle label="Bayad muna" name="p" defaultChecked />);
    expect(screen.getByText("Oo")).toBeInTheDocument();
    expect(screen.getByText("Hindi")).toBeInTheDocument(); // hidden by CSS when checked
  });
});
