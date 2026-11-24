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

import { CheckInForm, PAYMENT_CHOICE_REQUIRED } from "./CheckInForm";

const FREE = { fee: 0, payFirst: false, gcashName: null, gcashNumber: null };
const PAID = { fee: 150, payFirst: true, gcashName: "Juan Dela Cruz", gcashNumber: "09171234567" };

beforeEach(() => {
  push.mockReset();
  unlockAudio.mockReset();
  auth.getSession.mockReset().mockResolvedValue({ data: { session: null } });
  auth.signInAnonymously.mockReset().mockResolvedValue({ error: null });
  rpc.mockReset().mockResolvedValue({ data: "player-1", error: null });
});

describe("CheckInForm", () => {
  it("shows the fields, the privacy note and Pumila na; nothing signs in just by viewing", () => {
    render(<CheckInForm code="ABC234" payment={FREE} />);
    expect(screen.getByLabelText("Pangalan mo")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Level mo? (optional)" })).toBeInTheDocument();
    expect(screen.getByText(/Pangalan at level lang ang kinukuha namin/)).toBeInTheDocument();
    expect(screen.getByText("Walang account o app na kailangan.")).toBeInTheDocument();
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
    expect(auth.getSession).not.toHaveBeenCalled();
  });

  it("on Pumila na: unlocks audio, signs in anonymously, joins, and opens Pwesto", async () => {
    render(<CheckInForm code="ABC234" payment={FREE} />);
    await userEvent.type(screen.getByLabelText("Pangalan mo"), "  Tito  Boy ");
    await userEvent.click(screen.getByRole("button", { name: "Pumila na" }));
    expect(unlockAudio).toHaveBeenCalled();
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("join_session", { p_join_code: "ABC234", p_display_name: "Tito Boy", p_level: "unsure" });
    expect(push).toHaveBeenCalledWith("/j/ABC234/me");
  });

  it("reuses an existing session instead of signing in again", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    render(<CheckInForm code="ABC234" payment={FREE} />);
    await userEvent.type(screen.getByLabelText("Pangalan mo"), "Ana");
    await userEvent.click(screen.getByRole("radio", { name: "Advanced" }));
    await userEvent.click(screen.getByRole("button", { name: "Pumila na" }));
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("join_session", { p_join_code: "ABC234", p_display_name: "Ana", p_level: "advanced" });
  });

  it("validates the name before any sign-in", async () => {
    render(<CheckInForm code="ABC234" payment={FREE} />);
    await userEvent.click(screen.getByRole("button", { name: "Pumila na" }));
    expect(screen.getByText("Pakilagay ang pangalan.")).toBeInTheDocument();
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it("shows a closed check-in in Taglish", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "checkin_closed", code: "P0001" } });
    render(<CheckInForm code="ABC234" payment={FREE} />);
    await userEvent.type(screen.getByLabelText("Pangalan mo"), "Ana");
    await userEvent.click(screen.getByRole("button", { name: "Pumila na" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sarado na ang check-in.");
    expect(push).not.toHaveBeenCalled();
  });

  it("a free session has no payment step", () => {
    render(<CheckInForm code="ABC234" payment={FREE} />);
    expect(screen.queryByText(/Bayad ·/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("GCash reference number")).not.toBeInTheDocument();
  });

  it("with a fee: shows the club's GCash, the reference field, cash, and the pay-first line", () => {
    render(<CheckInForm code="ABC234" payment={PAID} />);
    expect(screen.getByRole("heading", { name: "Bayad · ₱150" })).toBeInTheDocument();
    expect(screen.getByText("I-send sa GCash ng club:")).toBeInTheDocument();
    expect(screen.getByText("Juan Dela Cruz")).toBeInTheDocument();
    expect(screen.getByText("0917 123 4567")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kopyahin ang number" })).toBeInTheDocument();
    expect(screen.getByLabelText("GCash reference number")).toHaveAccessibleDescription("Okay lang kahit may space o gitling.");
    expect(screen.getByRole("switch", { name: "Cash ang ibabayad ko" })).toBeInTheDocument();
    expect(screen.getByText("Kailangang bayad bago matawag.")).toBeInTheDocument();
  });

  it("with a fee, asks for a reference or cash before signing in", async () => {
    render(<CheckInForm code="ABC234" payment={PAID} />);
    await userEvent.type(screen.getByLabelText("Pangalan mo"), "Ana");
    await userEvent.click(screen.getByRole("button", { name: "Pumila na" }));
    expect(screen.getByText(PAYMENT_CHOICE_REQUIRED)).toBeInTheDocument();
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it("sends a GCash reference as typed (the database stores digits only)", async () => {
    render(<CheckInForm code="ABC234" payment={PAID} />);
    await userEvent.type(screen.getByLabelText("Pangalan mo"), "Ana");
    await userEvent.type(screen.getByLabelText("GCash reference number"), "1234 5678-90");
    await userEvent.click(screen.getByRole("button", { name: "Pumila na" }));
    expect(rpc).toHaveBeenCalledWith("join_session", {
      p_join_code: "ABC234",
      p_display_name: "Ana",
      p_level: "unsure",
      p_method: "gcash",
      p_reference: "1234 5678-90",
    });
  });

  it("refuses a reference that isn't 6-20 digits", async () => {
    render(<CheckInForm code="ABC234" payment={PAID} />);
    await userEvent.type(screen.getByLabelText("Pangalan mo"), "Ana");
    await userEvent.type(screen.getByLabelText("GCash reference number"), "12a45");
    await userEvent.click(screen.getByRole("button", { name: "Pumila na" }));
    expect(screen.getByText(/Mukhang mali ang reference number/)).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("cash: no reference needed", async () => {
    render(<CheckInForm code="ABC234" payment={PAID} />);
    await userEvent.type(screen.getByLabelText("Pangalan mo"), "Ben");
    await userEvent.click(screen.getByRole("switch", { name: "Cash ang ibabayad ko" }));
    expect(screen.getByLabelText("GCash reference number")).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Pumila na" }));
    expect(rpc).toHaveBeenCalledWith("join_session", expect.objectContaining({ p_method: "cash", p_reference: undefined }));
  });

  describe("returning player (D18)", () => {
    const ANA = { name: "Ana Dela Cruz", level: "advanced" };

    it("offers one tap: Pumila bilang …, keeping the level", async () => {
      auth.getSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
      render(<CheckInForm code="ABC234" payment={FREE} lastProfile={ANA} />);
      expect(screen.queryByLabelText("Pangalan mo")).not.toBeInTheDocument();
      expect(screen.getByText("Advanced")).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Pumila bilang Ana Dela Cruz" }));
      expect(auth.signInAnonymously).not.toHaveBeenCalled();
      expect(rpc).toHaveBeenCalledWith("join_session", {
        p_join_code: "ABC234",
        p_display_name: "Ana Dela Cruz",
        p_level: "advanced",
      });
      expect(push).toHaveBeenCalledWith("/j/ABC234/me");
    });

    it("Hindi ako si …: shows the empty form", async () => {
      render(<CheckInForm code="ABC234" payment={FREE} lastProfile={ANA} />);
      await userEvent.click(screen.getByRole("button", { name: "Hindi ako si Ana Dela Cruz" }));
      expect(screen.getByLabelText("Pangalan mo")).toHaveValue("");
      expect(screen.getByRole("button", { name: "Pumila na" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Pumila bilang/ })).not.toBeInTheDocument();
      await userEvent.type(screen.getByLabelText("Pangalan mo"), "Ben");
      await userEvent.click(screen.getByRole("button", { name: "Pumila na" }));
      expect(rpc).toHaveBeenCalledWith("join_session", expect.objectContaining({ p_display_name: "Ben", p_level: "unsure" }));
    });

    it("still asks for payment when there is a fee", async () => {
      render(<CheckInForm code="ABC234" payment={PAID} lastProfile={ANA} />);
      expect(screen.getByRole("heading", { name: "Bayad · ₱150" })).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Pumila bilang Ana Dela Cruz" }));
      expect(screen.getByText(PAYMENT_CHOICE_REQUIRED)).toBeInTheDocument();
      expect(rpc).not.toHaveBeenCalled();
      await userEvent.click(screen.getByRole("switch", { name: "Cash ang ibabayad ko" }));
      await userEvent.click(screen.getByRole("button", { name: "Pumila bilang Ana Dela Cruz" }));
      expect(rpc).toHaveBeenCalledWith("join_session", expect.objectContaining({ p_display_name: "Ana Dela Cruz", p_method: "cash" }));
    });
  });
});
