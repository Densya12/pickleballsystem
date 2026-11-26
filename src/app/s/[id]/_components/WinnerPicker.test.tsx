import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WinnerPicker } from "./WinnerPicker";

const players = [
  { id: "a", name: "Ana Reyes" },
  { id: "b", name: "Ben Cruz" },
  { id: "c", name: "Carlo" },
  { id: "d", name: "Dina" },
];

describe("WinnerPicker (D25): one tap on a side", () => {
  it("offers the two sides as they're drawn (left = team 1) and Skip", async () => {
    const onPick = vi.fn();
    render(<WinnerPicker players={players} format="doubles" allowSkip busy={false} onPick={onPick} onCancel={() => {}} />);
    expect(screen.getByRole("group", { name: "Who won?" })).toHaveAccessibleDescription("Tap the side that won.");
    const left = screen.getByRole("button", { name: /Ana \+ Ben won/ });
    expect(left).toHaveTextContent("Left side");
    expect(screen.getByRole("button", { name: /Carlo \+ Dina won/ })).toHaveTextContent("Right side");
    await userEvent.click(screen.getByRole("button", { name: /Carlo \+ Dina won/ }));
    expect(onPick).toHaveBeenCalledWith(["c", "d"]);
  });

  it("Skip records no winner", async () => {
    const onPick = vi.fn();
    render(<WinnerPicker players={players} format="doubles" allowSkip busy={false} onPick={onPick} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Skip (no winner)" }));
    expect(onPick).toHaveBeenCalledWith(null);
  });

  it("Winners stay: a winner is required (no Skip)", () => {
    render(<WinnerPicker players={players} format="doubles" allowSkip={false} busy={false} onPick={() => {}} onCancel={() => {}} />);
    expect(screen.queryByRole("button", { name: "Skip (no winner)" })).not.toBeInTheDocument();
  });

  it("singles: one name per side", async () => {
    const onPick = vi.fn();
    render(<WinnerPicker players={players.slice(0, 2)} format="singles" allowSkip busy={false} onPick={onPick} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /Ana won/ }));
    expect(onPick).toHaveBeenCalledWith(["a"]);
  });

  it("Cancel keeps the game going", async () => {
    const onCancel = vi.fn();
    render(<WinnerPicker players={players} format="doubles" allowSkip busy={false} onPick={() => {}} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
