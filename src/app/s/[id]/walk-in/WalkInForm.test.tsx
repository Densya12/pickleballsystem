import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = { push: vi.fn(), back: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const send = vi.fn();
vi.mock("../outbox-send", () => ({ sendOrganizerAction: (...args: unknown[]) => send(...args) }));
const addWalkIn = vi.fn();
vi.mock("./actions", () => ({ addWalkInAction: (...args: unknown[]) => addWalkIn(...args) }));

import { loadOutbox } from "@/lib/outbox/store";
import { WalkInForm } from "./WalkInForm";

const MEMBERS = [
  { id: "m1", name: "Ana Reyes", level: "advanced", duesStatus: "paid", notes: null },
  { id: "m2", name: "Ben Cruz", level: "beginner", duesStatus: "none", notes: null },
];

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => value });
}

beforeEach(() => {
  window.localStorage.clear();
  setOnline(true);
  for (const fn of Object.values(router)) fn.mockReset();
  send.mockReset().mockResolvedValue({});
  // On success the real action redirects to Live (from the server).
  addWalkIn.mockReset().mockResolvedValue({ playerId: "p1" });
});
afterEach(() => setOnline(true));

describe("WalkInForm", () => {
  it("has no payment choice picked when there is a fee", () => {
    render(<WalkInForm sessionId="s1" fee={150} />);
    expect(screen.getByRole("group", { name: "Bayad · ₱150" })).toBeInTheDocument();
    for (const name of ["Nagbayad ng cash", "GCash", "Mamaya na magbabayad"]) {
      expect(screen.getByRole("radio", { name: new RegExp(`^${name}`) })).not.toBeChecked();
    }
  });

  it("won't add the walk-in until a payment choice is picked", async () => {
    render(<WalkInForm sessionId="s1" fee={150} />);
    await userEvent.type(screen.getByLabelText("Pangalan"), "Tito Boy");
    await userEvent.click(screen.getByRole("button", { name: "Ilagay sa pila" }));

    expect(screen.getByRole("group", { name: "Bayad · ₱150" })).toHaveAccessibleDescription("Pumili kung paano magbabayad.");
    expect(addWalkIn).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("radio", { name: "Nagbayad ng cash" }));
    expect(screen.queryByText("Pumili kung paano magbabayad.")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Ilagay sa pila" }));
    expect(addWalkIn).toHaveBeenCalledTimes(1);
    const [sessionId, request] = addWalkIn.mock.calls[0];
    expect(sessionId).toBe("s1");
    expect(request).toMatchObject({ display_name: "Tito Boy", level: "unsure", payment: "cash_received", memberId: null, openLive: true });
    expect(request.clientId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("GCash needs a valid reference before submitting", async () => {
    render(<WalkInForm sessionId="s1" fee={150} />);
    await userEvent.type(screen.getByLabelText("Pangalan"), "Ana");
    await userEvent.click(screen.getByRole("radio", { name: /^GCash/ }));
    await userEvent.click(screen.getByRole("button", { name: "Ilagay sa pila" }));
    expect(screen.getByText(/Mukhang mali ang reference number/)).toBeInTheDocument();
    expect(addWalkIn).not.toHaveBeenCalled();
  });

  it("a free session has no payment step", async () => {
    render(<WalkInForm sessionId="s1" fee={0} />);
    expect(screen.queryByRole("group", { name: /Bayad/ })).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Pangalan"), "Libre Lito");
    await userEvent.click(screen.getByRole("button", { name: "Ilagay sa pila" }));
    expect(addWalkIn).toHaveBeenCalledTimes(1);
  });

  it("Pumili sa members: fills name and level, and links the member", async () => {
    render(<WalkInForm sessionId="s1" fee={0} members={MEMBERS} />);
    await userEvent.type(screen.getByLabelText("Pumili sa members"), "rey");
    await userEvent.click(screen.getByRole("button", { name: /Ana Reyes/ }));
    expect(screen.getByText("Napiling member")).toBeInTheDocument();
    expect(screen.getByLabelText("Pangalan")).toHaveValue("Ana Reyes");
    expect(screen.getByRole("radio", { name: "Advanced" })).toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "Ilagay sa pila" }));
    expect(addWalkIn.mock.calls[0][1]).toMatchObject({ display_name: "Ana Reyes", level: "advanced", memberId: "m1" });
  });

  it("shows the server's field errors", async () => {
    addWalkIn.mockResolvedValue({ fieldErrors: { display_name: "Masyadong maikli." } });
    render(<WalkInForm sessionId="s1" fee={0} />);
    await userEvent.type(screen.getByLabelText("Pangalan"), "Ab");
    await userEvent.click(screen.getByRole("button", { name: "Ilagay sa pila" }));
    expect(await screen.findByText("Masyadong maikli.")).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("offline: saves the walk-in to the outbox and goes back to Live", async () => {
    setOnline(false);
    render(<WalkInForm sessionId="s1" fee={150} />);
    expect(screen.getByText("Offline — ise-save pagbalik ng signal.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Pangalan"), "Tito Boy");
    await userEvent.click(screen.getByRole("radio", { name: "Mamaya na magbabayad" }));
    await userEvent.click(screen.getByRole("button", { name: "Ilagay sa pila" }));
    expect(addWalkIn).not.toHaveBeenCalled();
    const queued = loadOutbox("s1");
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ kind: "add_walk_in", label: "Walk-in: Tito Boy", args: { display_name: "Tito Boy", payment: "later" } });
    expect(queued[0].args).not.toHaveProperty("openLive");
    expect(router.back.mock.calls.length + router.push.mock.calls.length).toBe(1);
  });

  it("a network failure while 'online' also goes to the outbox", async () => {
    addWalkIn.mockRejectedValue(new TypeError("Failed to fetch"));
    // The replay that follows can't reach the server either.
    send.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<WalkInForm sessionId="s1" fee={0} />);
    await userEvent.type(screen.getByLabelText("Pangalan"), "Lito");
    await userEvent.click(screen.getByRole("button", { name: "Ilagay sa pila" }));
    expect(loadOutbox("s1")).toHaveLength(1);
  });
});
