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

import { en } from "@/lib/i18n/dictionary";
import { I18nProvider } from "@/lib/i18n/client";
import { CheckInForm } from "./CheckInForm";

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
  it("shows the fields, the privacy note and Join queue; nothing signs in just by viewing", () => {
    render(<CheckInForm code="ABC234" payment={FREE} />);
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Level (optional)" })).toBeInTheDocument();
    expect(screen.getByText(en.player.privacy)).toBeInTheDocument();
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
    expect(auth.getSession).not.toHaveBeenCalled();
  });

  it("on Join queue: unlocks audio, signs in anonymously, joins, and opens My place", async () => {
    render(<CheckInForm code="ABC234" payment={FREE} />);
    await userEvent.type(screen.getByLabelText("Name"), "  Tito  Boy ");
    await userEvent.click(screen.getByRole("button", { name: "Join queue" }));
    expect(unlockAudio).toHaveBeenCalled();
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("join_session", { p_join_code: "ABC234", p_display_name: "Tito Boy", p_level: "unsure" });
    expect(push).toHaveBeenCalledWith("/j/ABC234/me");
  });

  it("reuses an existing session and sends the chosen level", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    render(<CheckInForm code="ABC234" payment={FREE} />);
    await userEvent.type(screen.getByLabelText("Name"), "Ana");
    await userEvent.click(screen.getByRole("radio", { name: "Level 4" }));
    await userEvent.click(screen.getByRole("button", { name: "Join queue" }));
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("join_session", { p_join_code: "ABC234", p_display_name: "Ana", p_level: "4" });
  });

  it("validates the name before any sign-in", async () => {
    render(<CheckInForm code="ABC234" payment={FREE} />);
    await userEvent.click(screen.getByRole("button", { name: "Join queue" }));
    expect(screen.getByText(en.live.nameRequired)).toBeInTheDocument();
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it("with a fee: GCash is selected; the club's number and Copy are shown", () => {
    render(<CheckInForm code="ABC234" payment={PAID} />);
    expect(screen.getByRole("heading", { name: "Payment" })).toBeInTheDocument();
    expect(screen.getByText("₱150")).toBeInTheDocument();
    expect(screen.getByText(en.player.payFirstNote)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "GCash" })).toBeChecked();
    expect(screen.getByText("0917 123 4567")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });

  it("asks for a reference or cash", async () => {
    render(<CheckInForm code="ABC234" payment={PAID} />);
    await userEvent.type(screen.getByLabelText("Name"), "Ana");
    await userEvent.click(screen.getByRole("button", { name: "Join queue" }));
    expect(screen.getByText(en.player.referenceOrCash)).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sends a GCash reference as typed", async () => {
    render(<CheckInForm code="ABC234" payment={PAID} />);
    await userEvent.type(screen.getByLabelText("Name"), "Ana");
    await userEvent.type(screen.getByLabelText("GCash reference no."), "1234 5678-90");
    await userEvent.click(screen.getByRole("button", { name: "Join queue" }));
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
    await userEvent.type(screen.getByLabelText("Name"), "Ana");
    await userEvent.type(screen.getByLabelText("GCash reference no."), "12a45");
    await userEvent.click(screen.getByRole("button", { name: "Join queue" }));
    expect(screen.getByText(en.payments.invalidReference(6, 20))).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("cash: no reference needed", async () => {
    render(<CheckInForm code="ABC234" payment={PAID} />);
    await userEvent.type(screen.getByLabelText("Name"), "Ben");
    await userEvent.click(screen.getByRole("radio", { name: "Cash" }));
    expect(screen.queryByLabelText("GCash reference no.")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Join queue" }));
    expect(rpc).toHaveBeenCalledWith("join_session", expect.objectContaining({ p_method: "cash", p_reference: undefined }));
  });

  it("speaks Taglish when the device is set to Taglish", () => {
    render(
      <I18nProvider locale="fil">
        <CheckInForm code="ABC234" payment={FREE} />
      </I18nProvider>,
    );
    expect(screen.getByRole("button", { name: "Pumila na" })).toBeInTheDocument();
    expect(screen.getByLabelText("Pangalan mo")).toBeInTheDocument();
  });

  describe("returning player (D18)", () => {
    const ANA = { name: "Ana Dela Cruz", level: "4" };

    it("offers one tap: Join as …, keeping the level", async () => {
      auth.getSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
      render(<CheckInForm code="ABC234" payment={FREE} lastProfile={ANA} />);
      expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
      expect(screen.getByText("Level 4")).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Join as Ana Dela Cruz" }));
      expect(auth.signInAnonymously).not.toHaveBeenCalled();
      expect(rpc).toHaveBeenCalledWith("join_session", { p_join_code: "ABC234", p_display_name: "Ana Dela Cruz", p_level: "4" });
      expect(push).toHaveBeenCalledWith("/j/ABC234/me");
    });

    it("Not …?: shows the empty form", async () => {
      render(<CheckInForm code="ABC234" payment={FREE} lastProfile={ANA} />);
      await userEvent.click(screen.getByRole("button", { name: "Not Ana Dela Cruz?" }));
      expect(screen.getByLabelText("Name")).toHaveValue("");
      expect(screen.getByRole("button", { name: "Join queue" })).toBeInTheDocument();
      await userEvent.type(screen.getByLabelText("Name"), "Ben");
      await userEvent.click(screen.getByRole("button", { name: "Join queue" }));
      expect(rpc).toHaveBeenCalledWith("join_session", expect.objectContaining({ p_display_name: "Ben", p_level: "unsure" }));
    });

    it("still asks for payment when there is a fee", async () => {
      render(<CheckInForm code="ABC234" payment={PAID} lastProfile={ANA} />);
      await userEvent.click(screen.getByRole("button", { name: "Join as Ana Dela Cruz" }));
      expect(screen.getByText(en.player.referenceOrCash)).toBeInTheDocument();
      expect(rpc).not.toHaveBeenCalled();
      await userEvent.click(screen.getByRole("radio", { name: "Cash" }));
      await userEvent.click(screen.getByRole("button", { name: "Join as Ana Dela Cruz" }));
      expect(rpc).toHaveBeenCalledWith("join_session", expect.objectContaining({ p_display_name: "Ana Dela Cruz", p_method: "cash" }));
    });
  });

  it("QA-05: a name already in line shows on the name field", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "name_taken", code: "P0001" } });
    render(<CheckInForm code="ABC234" payment={FREE} />);
    await userEvent.type(screen.getByLabelText("Name"), "Mark Santos");
    await userEvent.click(screen.getByRole("button", { name: "Join queue" }));
    expect(screen.getByLabelText("Name")).toHaveAccessibleDescription("That name is already in line. Add your last initial, e.g. Mark D.");
    expect(push).not.toHaveBeenCalled();
  });
});
