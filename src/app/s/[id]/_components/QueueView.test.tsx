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
  courts: [{ id: "c1", number: 1, label: "Court 1", format: "doubles", game: null, staying: [], waitingSince: null }],
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

  it("keeps true queue order and real places: the next group is tagged in place, Cy (passed over) says why", () => {
    render(<QueueView state={state} rules={{ payFirst: false, fee: 0 }} sessionId="s1" />);
    const upNext = screen.getByRole("region", { name: "Up next" });
    const rows = within(upNext).getAllByRole("button");
    expect(rows.map((b) => b.textContent?.match(/Ana|Ben|Cy|Dee|Eli/)?.[0])).toEqual(["Ana", "Ben", "Cy", "Dee", "Eli"]);
    expect(rows.map((b) => b.textContent?.match(/^#?(\d+)/)?.[1])).toEqual(["1", "2", "3", "4", "5"]);
    const tagged = rows.filter((b) => within(b).queryByText("Next"));
    expect(tagged.map((b) => b.textContent?.match(/Ana|Ben|Cy|Dee|Eli/)?.[0])).toEqual(["Ana", "Ben", "Dee", "Eli"]);
    // Cy (level 5) under Mixed waits for a level 4-5 group, in place at #3.
    expect(within(rows[2]).getByText("Waiting for a level 4–5 group")).toBeInTheDocument();
    expect(within(rows[2]).queryByText("Next")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "After that" })).not.toBeInTheDocument();
  });

  it("a later arrival in the next group never appears above an earlier player", () => {
    render(<QueueView state={state} rules={{ payFirst: false, fee: 0 }} sessionId="s1" />);
    const names = screen.getAllByRole("button").map((b) => b.textContent?.match(/Ana|Ben|Cy|Dee|Eli/)?.[0]);
    expect(names.indexOf("Cy")).toBeLessThan(names.indexOf("Dee"));
    expect(names.indexOf("Cy")).toBeLessThan(names.indexOf("Eli"));
  });

  it("Fair line: the first 4 are tagged Next, the rest follow under After that; no waiting line", () => {
    const fair: LiveState = {
      ...state,
      preview: { preset: "fair_line", formats: { doubles: { status: "ok", group: ["a", "b", "c", "d"].map((id) => ({ id, name: id, skill: null })) } } },
    };
    render(<QueueView state={fair} rules={{ payFirst: false, fee: 0 }} sessionId="s1" />);
    const upNext = within(screen.getByRole("region", { name: "Up next" })).getAllByRole("button");
    expect(upNext.map((b) => b.textContent?.match(/Ana|Ben|Cy|Dee|Eli/)?.[0])).toEqual(["Ana", "Ben", "Cy", "Dee"]);
    expect(upNext.every((b) => within(b).queryByText("Next"))).toBe(true);
    const after = within(screen.getByRole("region", { name: "After that" })).getByRole("button", { name: /Eli/ });
    expect(after).toHaveTextContent(/^#?5/);
    expect(within(after).queryByText("Next")).not.toBeInTheDocument();
    expect(screen.queryByTestId("waiting-for")).not.toBeInTheDocument();
  });

  it("no group fits yet: nobody is tagged; the front of the line says which group they wait for", () => {
    const none: LiveState = { ...state, preview: { preset: "same_level", formats: { doubles: { status: "no_group", group: [], lo: 3, hi: 3 } } } };
    render(<QueueView state={none} rules={{ payFirst: false, fee: 0 }} sessionId="s1" />);
    expect(screen.queryByText("Next")).not.toBeInTheDocument();
    const ana = screen.getByRole("button", { name: /Ana/ });
    expect(within(ana).getByText("Waiting for a level 3 group")).toBeInTheDocument();
    expect(within(screen.getByRole("button", { name: /Ben/ })).getByText("Waiting for a group")).toBeInTheDocument();
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

  it("'Next' is the only filled lime pill; 'New' (a recent phone check-in) is a grey outline", () => {
    const fresh: LiveState = { ...state, queue: state.queue.map((p, i) => (i === 0 ? { ...p, isWalkIn: false, joinedAt: new Date().toISOString() } : p)) };
    render(<QueueView state={fresh} rules={{ payFirst: false, fee: 0 }} sessionId="s1" />);
    const ana = screen.getByRole("button", { name: /Ana/ });
    const next = within(ana).getByTestId("next-tag");
    const fresh_ = within(ana).getByTestId("new-tag");
    expect(next).toHaveClass("bg-accent");
    expect(fresh_).toHaveTextContent("New");
    expect(fresh_).toHaveClass("border", "border-field", "text-secondary");
    expect(fresh_.className).not.toMatch(/\bbg-/);
  });
});
