import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LiveCourt, LiveState } from "@/lib/queue/data";

const frame = {
  act: vi.fn(),
  busy: false,
  pending: [] as unknown[],
  showError: vi.fn(),
  runOnline: vi.fn(),
  sessionId: "s1",
};
vi.mock("./SessionFrame", () => ({ useSessionFrame: () => frame }));
const swapSidesAction = vi.fn();
vi.mock("../_lib/queue-actions", () => ({ swapSidesAction: (...args: unknown[]) => swapSidesAction(...args) }));

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
    staying: [],
    waitingSince: null,
  },
  {
    id: "c2",
    number: 2,
    label: "Court 2",
    format: "singles",
    game: { id: "g2", number: 2, format: "singles", startedAt: STARTED, players: [p("e", "Ella Go"), p("f", "Fe Uy")] },
    staying: [],
    waitingSince: null,
  },
  { id: "c3", number: 3, label: "Court 3", format: "doubles", game: null, staying: [], waitingSince: null },
];

function state(eligibleCount: number): LiveState {
  return {
    courts: COURTS,
    queue: [],
    playingCount: 6,
    eligibleCount,
    preview: null,
    payments: { paid: 0, total: 0, toCheck: 0, unpaid: 0 },
  };
}

const court = (name: string) => screen.getByRole("region", { name });
const chips = (el: HTMLElement) => [...el.querySelectorAll("[data-chip]")];

beforeEach(() => {
  frame.act.mockReset().mockResolvedValue(true);
  frame.showError.mockReset();
  frame.runOnline.mockReset().mockImplementation(async (run: () => Promise<unknown>) => {
    await run();
    return true;
  });
  swapSidesAction.mockReset().mockResolvedValue({ banner: "swapped" });
});

describe("Courts tab", () => {
  it("renders one court per court, with 4 chips for doubles and 2 for singles", () => {
    render(<CourtsView state={state(0)} rotation="fifo" rules={{ payFirst: false, fee: 0 }} />);
    expect(screen.getAllByRole("region")).toHaveLength(3);
    expect(chips(court("Court 1"))).toHaveLength(4);
    expect(chips(court("Court 2"))).toHaveLength(2);
    expect(chips(court("Court 3"))).toHaveLength(0);
  });

  it("shows the game number and minutes, Done on playing courts, and the not-ready swap", async () => {
    render(<CourtsView state={state(0)} rotation="fifo" rules={{ payFirst: false, fee: 0 }} />);
    expect(within(court("Court 1")).getByText("Game 1 · 7 min")).toBeInTheDocument();
    expect(within(court("Court 2")).getByText("Game 2 · 7 min")).toBeInTheDocument();
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

  it("highlights a court only when a new game starts after the screen opened", () => {
    const rules = { payFirst: false, fee: 0 };
    const { rerender } = render(<CourtsView state={state(5)} rotation="fifo" rules={rules} />);
    expect(document.querySelectorAll("[data-new-game]")).toHaveLength(0);

    // Court 2's game ends and the same two players start game 3 (a new game id).
    const again = { id: "g3", number: 3, format: "singles", startedAt: new Date().toISOString(), players: [p("e", "Ella Go"), p("f", "Fe Uy")] };
    const next = { ...state(5), courts: COURTS.map((c) => (c.id === "c2" ? { ...c, game: again } : c)) };
    rerender(<CourtsView state={next} rotation="fifo" rules={rules} />);
    expect(court("Court 2")).toHaveAttribute("data-new-game");
    expect(court("Court 2")).toHaveClass("court-new-game");
    expect(within(court("Court 2")).getByText("Game 3 · 0 min")).toBeInTheDocument();
    expect(court("Court 1")).not.toHaveAttribute("data-new-game");
  });

  it("Done always asks who won, one tap on a side (D25); Skip outside Winners stay", async () => {
    render(<CourtsView state={state(0)} rotation="all_off" rules={{ payFirst: false, fee: 0 }} />);
    await userEvent.click(screen.getByRole("button", { name: "Done on Court 1" }));
    const picker = within(court("Court 1")).getByRole("group", { name: "Who won?" });
    // Sides as drawn: Ana + Ben on the left, Carlo + Dina on the right.
    await userEvent.click(within(picker).getByRole("button", { name: /Carlo \+ Dina won/ }));
    expect(frame.act).toHaveBeenCalledWith("finish_game", { courtId: "c1", gameId: "g1", winnerIds: ["c", "d"] }, expect.any(String));

    await userEvent.click(screen.getByRole("button", { name: "Done on Court 2" }));
    await userEvent.click(within(court("Court 2")).getByRole("button", { name: "Skip (no winner)" }));
    expect(frame.act).toHaveBeenCalledWith("finish_game", { courtId: "c2", gameId: "g2", winnerIds: null }, expect.any(String));
  });

  it("winners stay: a winner is required (no Skip); singles has one name per side", async () => {
    render(<CourtsView state={state(0)} rotation="winners_stay" rules={{ payFirst: false, fee: 0 }} />);
    await userEvent.click(screen.getByRole("button", { name: "Done on Court 2" }));
    const picker = within(court("Court 2")).getByRole("group", { name: "Who won?" });
    expect(within(picker).queryByRole("button", { name: "Skip (no winner)" })).not.toBeInTheDocument();
    await userEvent.click(within(picker).getByRole("button", { name: /Fe won/ }));
    expect(frame.act).toHaveBeenCalledWith("finish_game", { courtId: "c2", gameId: "g2", winnerIds: ["f"] }, expect.any(String));
  });

  it("team swap: tap a player, then one on the other side (online only, not queued)", async () => {
    render(<CourtsView state={state(0)} rotation="all_off" rules={{ payFirst: false, fee: 0 }} />);
    const c1 = court("Court 1");
    await userEvent.click(within(c1).getByRole("button", { name: "Ana Reyes, Left side. Tap to swap sides" }));
    expect(within(c1).getByRole("button", { name: "Ana Reyes, Left side. Tap to swap sides" })).toHaveAttribute("aria-pressed", "true");
    expect(within(c1).getAllByText("Now tap a player on the other side to swap with Ana Reyes.")).toHaveLength(2); // visible + announced
    // Same side: the choice moves to Ben.
    await userEvent.click(within(c1).getByRole("button", { name: "Ben Cruz, Left side. Tap to swap sides" }));
    expect(swapSidesAction).not.toHaveBeenCalled();
    await userEvent.click(within(c1).getByRole("button", { name: "Carlo Diaz, Right side. Tap to swap sides" }));
    expect(swapSidesAction).toHaveBeenCalledWith("s1", "c1", "b", "c");
    expect(frame.act).not.toHaveBeenCalledWith("swap_sides", expect.anything(), expect.anything());
    // Singles courts have no team swap.
    expect(within(court("Court 2")).queryByRole("button", { name: /Tap to swap sides/ })).not.toBeInTheDocument();
  });
  it("D25: an empty court with no level group says so and offers Call mixed; Up next says why", async () => {
    const noGroup = {
      ...state(5),
      preview: { preset: "mixed", formats: { doubles: { status: "no_group" as const, group: [], lo: 2, hi: 4 } } },
    };
    render(<CourtsView state={noGroup} rotation="all_off" rules={{ payFirst: false, fee: 0 }} />);
    const c3 = court("Court 3");
    expect(within(c3).getByText("No level 2–4 group yet")).toBeInTheDocument();
    expect(within(c3).queryByRole("button", { name: "Call next 4" })).not.toBeInTheDocument();
    await userEvent.click(within(c3).getByRole("button", { name: "Call mixed on Court 3" }));
    expect(frame.act).toHaveBeenCalledWith("call_mixed", { courtId: "c3" }, expect.any(String));
    expect(screen.getAllByText("No level 2–4 group yet")).toHaveLength(2);
  });

  it("D25: Up next is the server's group, with its level range", () => {
    const ok = {
      ...state(5),
      queue: ["a", "c", "d", "f", "b"].map((id, i) => ({
        id, name: `P${id}`, level: "3", status: "queued" as const, gamesPlayed: 0, notReady: false, paymentStatus: "unpaid",
        memberId: null, joinedAt: STARTED, isWalkIn: true, position: i + 1,
      })),
      preview: {
        preset: "mixed",
        formats: { doubles: { status: "ok" as const, group: ["a", "c", "d", "f"].map((id) => ({ id, name: `P${id}`, skill: 3 })), lo: 2, hi: 3 } },
      },
    };
    render(<CourtsView state={ok} rotation="all_off" rules={{ payFirst: false, fee: 0 }} />);
    expect(screen.getByText("Pa, Pc, Pd, Pf · levels 2–3")).toBeInTheDocument();
  });
});
