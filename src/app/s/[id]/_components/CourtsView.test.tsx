import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LiveCourt, LiveState } from "@/lib/queue/data";

const frame = { act: vi.fn(), busy: false, pending: [] as unknown[], showError: vi.fn() };
vi.mock("./SessionFrame", () => ({ useSessionFrame: () => frame }));

import { CourtsView } from "./CourtsView";

const STARTED = new Date(Date.now() - 7 * 60_000).toISOString();
const p = (id: string, name: string, notReady = false) => ({ id, name, notReady });

const COURTS: LiveCourt[] = [
  {
    id: "c1",
    number: 1,
    label: "Court 1",
    format: "doubles",
    game: { id: "g1", number: 1, format: "doubles", startedAt: STARTED, players: [p("a", "Ana Reyes"), p("b", "Ben Cruz"), p("c", "Carlo Diaz"), p("d", "Dina Lim", true)] },
  },
  {
    id: "c2",
    number: 2,
    label: "Court 2",
    format: "singles",
    game: { id: "g2", number: 2, format: "singles", startedAt: STARTED, players: [p("e", "Ella Go"), p("f", "Fe Uy")] },
  },
  { id: "c3", number: 3, label: "Court 3", format: "doubles", game: null },
];

function state(eligibleCount: number): LiveState {
  return {
    courts: COURTS,
    queue: [],
    playingCount: 6,
    eligibleCount,
    payments: { paid: 0, total: 0, toCheck: 0, unpaid: 0 },
  };
}

const court = (name: string) => screen.getByRole("region", { name });
const chips = (el: HTMLElement) => [...el.querySelectorAll("[data-chip]")];

beforeEach(() => {
  frame.act.mockReset().mockResolvedValue(true);
  frame.showError.mockReset();
});

describe("Courts tab", () => {
  it("renders one court per court, with 4 chips for doubles and 2 for singles", () => {
    render(<CourtsView state={state(0)} rotation="fifo" rules={{ payFirst: false, fee: 0 }} />);
    expect(screen.getAllByRole("region")).toHaveLength(3);
    expect(chips(court("Court 1"))).toHaveLength(4);
    expect(chips(court("Court 2"))).toHaveLength(2);
    expect(chips(court("Court 3"))).toHaveLength(0);
  });

  it("shows format and minutes, Done on playing courts, and the not-ready swap", async () => {
    render(<CourtsView state={state(0)} rotation="fifo" rules={{ payFirst: false, fee: 0 }} />);
    expect(within(court("Court 1")).getByText("Doubles · 7 min")).toBeInTheDocument();
    expect(within(court("Court 2")).getByText("Singles · 7 min")).toBeInTheDocument();
    expect(within(court("Court 3")).getByText("Doubles · Empty")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done on Court 2" })).toBeInTheDocument();

    await userEvent.click(within(court("Court 1")).getByRole("button", { name: "Dina isn't ready · Swap" }));
    expect(frame.act).toHaveBeenCalledWith("swap_not_ready", { courtId: "c1", playerId: "d" }, expect.any(String));
  });

  it("an empty court calls the next 4, or says how many more are needed", async () => {
    const { unmount } = render(<CourtsView state={state(5)} rotation="fifo" rules={{ payFirst: false, fee: 0 }} />);
    await userEvent.click(within(court("Court 3")).getByRole("button", { name: "Call next 4" }));
    expect(frame.act).toHaveBeenCalledWith("call_next", { courtId: "c3" }, expect.any(String));
    unmount();

    render(<CourtsView state={state(1)} rotation="fifo" rules={{ payFirst: false, fee: 0 }} />);
    const needMore = within(court("Court 3")).getByRole("button", { name: "Need 3 more" });
    expect(needMore).toBeEnabled();
    await userEvent.click(needMore);
    expect(frame.showError).toHaveBeenCalled();
  });

  it("winners stay: Done opens the winner picker (2 in doubles, 1 in singles)", async () => {
    render(<CourtsView state={state(0)} rotation="winners_stay" rules={{ payFirst: false, fee: 0 }} />);
    await userEvent.click(screen.getByRole("button", { name: "Done on Court 2" }));
    const picker = within(court("Court 2")).getByRole("group", { name: "Who won?" });
    expect(picker).toHaveAccessibleDescription("Pick 1 more.");
    await userEvent.click(within(picker).getByRole("button", { name: "Fe Uy" }));
    await userEvent.click(within(picker).getByRole("button", { name: "Confirm" }));
    expect(frame.act).toHaveBeenCalledWith("finish_game", { courtId: "c2", gameId: "g2", winnerIds: ["f"] }, expect.any(String));
  });
});
