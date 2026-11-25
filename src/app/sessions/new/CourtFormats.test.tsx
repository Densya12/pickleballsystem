import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Stepper } from "@/components/ui";
import type { CourtFormat } from "@/lib/session/validation";
import { CourtFormats } from "./CourtFormats";

/** The same wiring as New session: the stepper drives the rows. */
function Harness() {
  const [count, setCount] = useState(2);
  const [formats, setFormats] = useState<CourtFormat[]>([]);
  return (
    <form>
      <Stepper label="Courts" decrementLabel="Fewer courts" incrementLabel="More courts" name="courts_count" min={1} max={8} defaultValue={2} onValueChange={setCount} />
      <CourtFormats
        count={count}
        formats={formats}
        onChange={(i, f) => setFormats((c) => Object.assign([...c], { [i]: f }))}
      />
    </form>
  );
}

const row = (n: number) => screen.queryByRole("group", { name: `Court ${n}` });

describe("New session: court formats", () => {
  it("shows one Doubles/Singles row per court, Doubles by default", () => {
    render(<Harness />);
    expect(row(1)).toBeInTheDocument();
    expect(row(2)).toBeInTheDocument();
    expect(row(3)).not.toBeInTheDocument();
    for (const n of [1, 2]) {
      expect(screen.getAllByRole("radio", { name: "Doubles" })[n - 1]).toBeChecked();
    }
  });

  it("adding a court adds a Doubles row and keeps existing choices", async () => {
    render(<Harness />);
    await userEvent.click(screen.getAllByRole("radio", { name: "Singles" })[1]);
    await userEvent.click(screen.getByRole("button", { name: "More courts" }));
    expect(row(3)).toBeInTheDocument();
    const singles = screen.getAllByRole("radio", { name: "Singles" });
    const doubles = screen.getAllByRole("radio", { name: "Doubles" });
    expect(doubles[0]).toBeChecked();
    expect(singles[1]).toBeChecked();
    expect(doubles[2]).toBeChecked();
  });

  it("removing a court hides its row, and adding it back restores the choice", async () => {
    render(<Harness />);
    await userEvent.click(screen.getAllByRole("radio", { name: "Singles" })[1]);
    await userEvent.click(screen.getByRole("button", { name: "Fewer courts" }));
    expect(row(2)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "More courts" }));
    expect(screen.getAllByRole("radio", { name: "Singles" })[1]).toBeChecked();
  });

  it("each row posts as court_format_N", async () => {
    const { container } = render(<Harness />);
    await userEvent.click(screen.getAllByRole("radio", { name: "Singles" })[0]);
    const data = new FormData(container.querySelector("form")!);
    expect(data.get("court_format_1")).toBe("singles");
    expect(data.get("court_format_2")).toBe("doubles");
  });
});
