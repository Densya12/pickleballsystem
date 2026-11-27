import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LiveState, QueueEntry } from "@/lib/queue/data";

const frame = { act: vi.fn(), busy: false, pending: [] as unknown[], showError: vi.fn(), runOnline: vi.fn(), sessionId: "s1" };
vi.mock("./SessionFrame", () => ({ useSessionFrame: () => frame }));
vi.mock("@/components/session/SaveAsMember", () => ({ SaveAsMember: () => null }));

import { QueueView } from "./QueueView";

const row = (id: string, name: string, level: string, position: number): QueueEntry => ({
  id,
  name,
  level,
  status: "queued",
  gamesPlayed: 0,
  notReady: false,
  paymentStatus: "unpaid",
  memberId: null,
  joinedAt: new Date(Date.now() - 60 * 60_000).toISOString(),
  isWalkIn: true,
  position,
});

const state: LiveState = {
  courts: [{ id: "c1", number: 1, label: "Court 1", format: "doubles", game: null }],
  queue: [row("a", "Ana", "3", 1), row("b", "Ben", "unsure", 2), row("c", "Cy", "5", 3), row("d", "Dee", "2", 4), row("e", "Eli", "3", 5)],
  playingCount: 0,
  eligibleCount: 5,
  preview: {
    preset: "mixed",
    formats: { doubles: { status: "ok", group: ["a", "b", "d", "e"].map((id) => ({ id, name: id, skill: 3 })), lo: 2, hi: 3 } },
  },
  payments: { paid: 0, total: 0, toCheck: 0, unpaid: 0 },
};

beforeEach(() => {
  frame.act.mockReset().mockResolvedValue(true);
  // jsdom has no showModal/close: open the native <dialog> by its attribute.
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});

describe("Queue tab (D25)", () => {
  it("shows a level badge on each row ('Level 3', or 'Not set') instead of the old 'Not sure' text", () => {
    render(<QueueView state={state} rules={{ payFirst: false, fee: 0 }} sessionId="s1" />);
    const ana = screen.getByRole("button", { name: /Ana/ });
    expect(within(ana).getByText("Level 3")).toHaveClass("sr-only");
    const ben = screen.getByRole("button", { name: /Ben/ });
    expect(within(ben).getByText("Not set")).toBeVisible();
    expect(screen.queryByText("Not sure")).not.toBeInTheDocument();
  });

  it("'Up next' is the server's next group (Cy, level 5, waits in 'After that')", () => {
    render(<QueueView state={state} rules={{ payFirst: false, fee: 0 }} sessionId="s1" />);
    const upNext = screen.getByRole("region", { name: "Up next" });
    expect(within(upNext).getAllByRole("button").map((b) => b.textContent?.match(/Ana|Ben|Cy|Dee|Eli/)?.[0])).toEqual(["Ana", "Ben", "Dee", "Eli"]);
    expect(within(screen.getByRole("region", { name: "After that" })).getByRole("button", { name: /Cy/ })).toBeInTheDocument();
  });

  it("the organizer changes a level: tap the name, Level, pick, Save level", async () => {
    render(<QueueView state={state} rules={{ payFirst: false, fee: 0 }} sessionId="s1" />);
    await userEvent.click(screen.getByRole("button", { name: /Ben/ }));
    const sheet = screen.getByRole("dialog", { name: "Ben" });
    await userEvent.click(within(sheet).getByRole("button", { name: /^Level/ }));
    const picker = within(sheet).getByRole("group", { name: "Ben's level" });
    await userEvent.click(within(picker).getByRole("radio", { name: "Level 4" }));
    await userEvent.click(within(sheet).getByRole("button", { name: "Save level" }));
    expect(frame.act).toHaveBeenCalledWith("set_player_level", { playerId: "b", level: "4" }, "Ben: Level 4");
  });
});
