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
    render(<WinnerPicker players={players} needed={2} busy={false} onConfirm={onConfirm} onCancel={() => {}} />);
    expect(screen.getByRole("group", { name: "Who won?" })).toHaveAccessibleDescription("Pick 2 more.");
    const confirm = screen.getByRole("button", { name: "Confirm" });
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
    render(<WinnerPicker players={players} needed={2} busy={false} onConfirm={onConfirm} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Ana" }));
    await userEvent.click(screen.getByRole("button", { name: "Ana" }));
    expect(screen.getByRole("button", { name: "Ana" })).toHaveAttribute("aria-pressed", "false");

    for (const name of ["Ana", "Ben", "Dina"]) await userEvent.click(screen.getByRole("button", { name }));
    expect(screen.getByRole("button", { name: "Ana" })).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onConfirm).toHaveBeenCalledWith(["b", "d"]);
  });

  it("can be cancelled", async () => {
    const onCancel = vi.fn();
    render(<WinnerPicker players={players} needed={2} busy={false} onConfirm={() => {}} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("singles: pick 1 winner from 2", async () => {
    const onConfirm = vi.fn();
    render(<WinnerPicker players={players.slice(0, 2)} needed={1} busy={false} onConfirm={onConfirm} onCancel={() => {}} />);
    expect(screen.getByRole("group", { name: "Who won?" })).toHaveAccessibleDescription("Pick 1 more.");
    expect(screen.getAllByRole("button", { pressed: false })).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: "Ana" }));
    await userEvent.click(screen.getByRole("button", { name: "Ben" }));
    expect(screen.getByRole("button", { name: "Ana" })).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onConfirm).toHaveBeenCalledWith(["b"]);
  });
});

describe("WinnerPicker while saving", () => {
  it("disables both buttons and shows Saving", () => {
    render(<WinnerPicker players={players} needed={2} busy onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Saving/ })).toBeDisabled();
  });
});
