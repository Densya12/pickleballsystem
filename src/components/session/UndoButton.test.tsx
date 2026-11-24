import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeedbackBanner } from "./FeedbackBanner";
import { UndoButton } from "./UndoButton";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-24T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("UndoButton", () => {
  it("counts down from 30 seconds, then disappears", () => {
    const deadline = Date.now() + 30_000;
    render(<UndoButton deadline={deadline} onUndo={() => {}} />);
    expect(screen.getByRole("button", { name: "Ibalik (30s)" })).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByRole("button", { name: "Ibalik (20s)" })).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(19_000));
    expect(screen.getByRole("button", { name: "Ibalik (1s)" })).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.queryByRole("button", { name: /Ibalik/ })).not.toBeInTheDocument();
  });

  it("calls onUndo when tapped", () => {
    const onUndo = vi.fn();
    render(<UndoButton deadline={Date.now() + 30_000} onUndo={onUndo} />);
    fireEvent.click(screen.getByRole("button", { name: /Ibalik/ }));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("shows nothing for an offer that already ended", () => {
    render(<UndoButton deadline={Date.now() - 1} onUndo={() => {}} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("FeedbackBanner", () => {
  it("keeps the message and Isara after the undo offer ends", () => {
    const onClose = vi.fn();
    render(
      <FeedbackBanner text="Inalis si Ana sa pila." onClose={onClose} undo={{ deadline: Date.now() + 30_000, onUndo: () => {} }} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Inalis si Ana sa pila.");
    expect(screen.getByRole("button", { name: "Ibalik (30s)" })).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(30_000));
    expect(screen.queryByRole("button", { name: /Ibalik/ })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Inalis si Ana sa pila.");
    fireEvent.click(screen.getByRole("button", { name: "Isara" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("restarts the countdown for a new offer", () => {
    const { rerender } = render(<FeedbackBanner text="Unang aksyon" undo={{ deadline: Date.now() + 30_000, onUndo: () => {} }} />);
    act(() => vi.advanceTimersByTime(25_000));
    expect(screen.getByRole("button", { name: "Ibalik (5s)" })).toBeInTheDocument();
    rerender(<FeedbackBanner text="Pangalawang aksyon" undo={{ deadline: Date.now() + 30_000, onUndo: () => {} }} />);
    expect(screen.getByRole("button", { name: "Ibalik (30s)" })).toBeInTheDocument();
  });
});
