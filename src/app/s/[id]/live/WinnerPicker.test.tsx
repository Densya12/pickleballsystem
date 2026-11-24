import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WinnerPicker } from "./WinnerPicker";

const players = [
  { id: "a", name: "Ana" },
  { id: "b", name: "Ben" },
  { id: "c", name: "Carlo" },
  { id: "d", name: "Dina" },
];

describe("WinnerPicker", () => {
  it("asks who won and confirms only after 2 picks", async () => {
    const onConfirm = vi.fn();
    render(<WinnerPicker players={players} onConfirm={onConfirm} onCancel={() => {}} />);
    expect(screen.getByRole("group", { name: "Sino ang nanalo?" })).toHaveAccessibleDescription("Pumili ng 2 pa.");
    const confirm = screen.getByRole("button", { name: "Kumpirmahin" });
    expect(confirm).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Carlo" }));
    expect(screen.getByRole("button", { name: "Carlo" })).toHaveAttribute("aria-pressed", "true");
    expect(confirm).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Ana" }));
    expect(confirm).toBeEnabled();

    await userEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith(["c", "a"]);
  });

  it("un-picks and replaces picks", async () => {
    const onConfirm = vi.fn();
    render(<WinnerPicker players={players} onConfirm={onConfirm} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Ana" }));
    await userEvent.click(screen.getByRole("button", { name: "Ana" }));
    expect(screen.getByRole("button", { name: "Ana" })).toHaveAttribute("aria-pressed", "false");

    for (const name of ["Ana", "Ben", "Dina"]) await userEvent.click(screen.getByRole("button", { name }));
    expect(screen.getByRole("button", { name: "Ana" })).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(screen.getByRole("button", { name: "Kumpirmahin" }));
    expect(onConfirm).toHaveBeenCalledWith(["b", "d"]);
  });

  it("can be cancelled", async () => {
    const onCancel = vi.fn();
    render(<WinnerPicker players={players} onConfirm={() => {}} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole("button", { name: "Huwag muna" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("singles: pick 1 winner from 2", async () => {
    const onConfirm = vi.fn();
    render(<WinnerPicker players={players.slice(0, 2)} needed={1} onConfirm={onConfirm} onCancel={() => {}} />);
    expect(screen.getByRole("group", { name: "Sino ang nanalo?" })).toHaveAccessibleDescription("Pumili ng 1 pa.");
    expect(screen.getAllByRole("button", { pressed: false })).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: "Ana" }));
    await userEvent.click(screen.getByRole("button", { name: "Ben" }));
    expect(screen.getByRole("button", { name: "Ana" })).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(screen.getByRole("button", { name: "Kumpirmahin" }));
    expect(onConfirm).toHaveBeenCalledWith(["b"]);
  });
});
