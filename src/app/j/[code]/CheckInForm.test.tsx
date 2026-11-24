import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const unlockAudio = vi.fn();
vi.mock("@/lib/player/alert", () => ({ unlockAudio: () => unlockAudio() }));

const auth = { getSession: vi.fn(), signInAnonymously: vi.fn() };
const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth, rpc }) }));

import { CheckInForm } from "./CheckInForm";

beforeEach(() => {
  push.mockReset();
  unlockAudio.mockReset();
  auth.getSession.mockReset().mockResolvedValue({ data: { session: null } });
  auth.signInAnonymously.mockReset().mockResolvedValue({ error: null });
  rpc.mockReset().mockResolvedValue({ data: "player-1", error: null });
});

describe("CheckInForm", () => {
  it("shows the fields, the privacy note and Pumila na; nothing signs in just by viewing", () => {
    render(<CheckInForm code="ABC234" />);
    expect(screen.getByLabelText("Pangalan mo")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Level mo? (optional)" })).toBeInTheDocument();
    expect(screen.getByText(/Pangalan at level lang ang kinukuha namin/)).toBeInTheDocument();
    expect(screen.getByText("Walang account o app na kailangan.")).toBeInTheDocument();
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
    expect(auth.getSession).not.toHaveBeenCalled();
  });

  it("on Pumila na: unlocks audio, signs in anonymously, joins, and opens Pwesto", async () => {
    render(<CheckInForm code="ABC234" />);
    await userEvent.type(screen.getByLabelText("Pangalan mo"), "  Tito  Boy ");
    await userEvent.click(screen.getByRole("button", { name: "Pumila na" }));
    expect(unlockAudio).toHaveBeenCalled();
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("join_session", { p_join_code: "ABC234", p_display_name: "Tito Boy", p_level: "unsure" });
    expect(push).toHaveBeenCalledWith("/j/ABC234/me");
  });

  it("reuses an existing session instead of signing in again", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    render(<CheckInForm code="ABC234" />);
    await userEvent.type(screen.getByLabelText("Pangalan mo"), "Ana");
    await userEvent.click(screen.getByRole("radio", { name: "Advanced" }));
    await userEvent.click(screen.getByRole("button", { name: "Pumila na" }));
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("join_session", { p_join_code: "ABC234", p_display_name: "Ana", p_level: "advanced" });
  });

  it("validates the name before any sign-in", async () => {
    render(<CheckInForm code="ABC234" />);
    await userEvent.click(screen.getByRole("button", { name: "Pumila na" }));
    expect(screen.getByText("Pakilagay ang pangalan.")).toBeInTheDocument();
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it("shows a closed check-in in Taglish", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "checkin_closed", code: "P0001" } });
    render(<CheckInForm code="ABC234" />);
    await userEvent.type(screen.getByLabelText("Pangalan mo"), "Ana");
    await userEvent.click(screen.getByRole("button", { name: "Pumila na" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sarado na ang check-in.");
    expect(push).not.toHaveBeenCalled();
  });
});
