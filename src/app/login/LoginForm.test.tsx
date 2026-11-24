import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const signInWithOtp = vi.fn();
const signInWithOAuth = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithOtp, signInWithOAuth } }),
}));

import { LoginForm } from "./LoginForm";

beforeEach(() => {
  signInWithOtp.mockReset();
  signInWithOAuth.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("LoginForm", () => {
  it("shows both sign-in options", () => {
    render(<LoginForm next="/" />);
    expect(screen.getByRole("button", { name: /Mag-sign in gamit ang Google/ })).toBeVisible();
    expect(screen.getByLabelText("Email mo")).toBeVisible();
    expect(screen.getByRole("button", { name: "Ipadala ang login link" })).toBeVisible();
  });

  it("validates the email before calling Supabase", async () => {
    render(<LoginForm next="/" />);
    await userEvent.type(screen.getByLabelText("Email mo"), "juan");
    await userEvent.click(screen.getByRole("button", { name: "Ipadala ang login link" }));
    expect(screen.getByLabelText("Email mo")).toHaveAccessibleDescription(
      "Mukhang mali ang email. Hal. juan@gmail.com",
    );
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("sends the magic link with the confirm URL and next path", async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    render(<LoginForm next="/invite/abc" />);
    await userEvent.type(screen.getByLabelText("Email mo"), " tito@gmail.com ");
    await userEvent.click(screen.getByRole("button", { name: "Ipadala ang login link" }));

    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "tito@gmail.com",
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm?next=%2Finvite%2Fabc` },
    });
    expect(await screen.findByRole("heading", { name: "I-check ang email mo" })).toBeVisible();
    expect(screen.getByText("tito@gmail.com")).toBeVisible();
  });

  it("enables 'Ipadala ulit' only after 60 seconds", async () => {
    vi.useFakeTimers();
    signInWithOtp.mockResolvedValue({ error: null });
    render(<LoginForm next="/" />);
    fireEvent.change(screen.getByLabelText("Email mo"), { target: { value: "tito@gmail.com" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Ipadala ang login link" }));
    });

    const resend = screen.getByRole("button", { name: "Ipadala ulit" });
    expect(resend).toBeDisabled();

    await act(async () => {
      for (let i = 0; i < 59; i++) await vi.advanceTimersByTimeAsync(1000);
    });
    expect(resend).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(resend).toBeEnabled();
  });

  it("shows the 'try Google' message when Supabase refuses the email", async () => {
    signInWithOtp.mockResolvedValue({
      error: { status: 400, code: "email_address_not_authorized", message: "Email address not authorized" },
    });
    render(<LoginForm next="/" />);
    await userEvent.type(screen.getByLabelText("Email mo"), "tito@gmail.com");
    await userEvent.click(screen.getByRole("button", { name: "Ipadala ang login link" }));
    expect(
      await screen.findByText("Hindi maipadala ang login link ngayon. Subukan ang Google sign-in."),
    ).toBeVisible();
    expect(screen.queryByRole("heading", { name: "I-check ang email mo" })).not.toBeInTheDocument();
  });

  it("starts Google sign-in with the callback URL", async () => {
    signInWithOAuth.mockResolvedValue({ error: null });
    render(<LoginForm next="/settings" />);
    await userEvent.click(screen.getByRole("button", { name: /Mag-sign in gamit ang Google/ }));
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=%2Fsettings` },
    });
  });

  it("shows an error passed from the auth callback", () => {
    render(<LoginForm next="/" initialError="Hindi natuloy ang pag-sign in. Subukan ulit." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Hindi natuloy ang pag-sign in. Subukan ulit.");
  });
});
