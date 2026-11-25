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
    expect(screen.getByRole("button", { name: /Continue with Google/ })).toBeVisible();
    expect(screen.getByLabelText("Email")).toBeVisible();
    expect(screen.getByRole("button", { name: "Email me a sign-in link" })).toBeVisible();
  });

  it("validates the email before calling Supabase", async () => {
    render(<LoginForm next="/" />);
    await userEvent.type(screen.getByLabelText("Email"), "juan");
    await userEvent.click(screen.getByRole("button", { name: "Email me a sign-in link" }));
    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription(
      "That email doesn't look right. E.g. juan@gmail.com",
    );
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("sends the magic link with the confirm URL and next path", async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    render(<LoginForm next="/invite/abc" />);
    await userEvent.type(screen.getByLabelText("Email"), " tito@gmail.com ");
    await userEvent.click(screen.getByRole("button", { name: "Email me a sign-in link" }));

    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "tito@gmail.com",
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm?next=%2Finvite%2Fabc` },
    });
    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeVisible();
    expect(screen.getByText(/tito@gmail\.com/)).toBeVisible();
  });

  it("enables 'Send again' only after 60 seconds", async () => {
    vi.useFakeTimers();
    signInWithOtp.mockResolvedValue({ error: null });
    render(<LoginForm next="/" />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "tito@gmail.com" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Email me a sign-in link" }));
    });

    const resend = screen.getByRole("button", { name: "Send again" });
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
    await userEvent.type(screen.getByLabelText("Email"), "tito@gmail.com");
    await userEvent.click(screen.getByRole("button", { name: "Email me a sign-in link" }));
    expect(
      await screen.findByText("We can't send a sign-in link right now. Try Google instead."),
    ).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Check your email" })).not.toBeInTheDocument();
  });

  it("starts Google sign-in with the callback URL", async () => {
    signInWithOAuth.mockResolvedValue({ error: null });
    render(<LoginForm next="/settings" />);
    await userEvent.click(screen.getByRole("button", { name: /Continue with Google/ }));
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=%2Fsettings` },
    });
  });

  it("shows an error passed from the auth callback", () => {
    render(<LoginForm next="/" initialError="Sign-in didn't finish. Try again." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Sign-in didn't finish. Try again.");
  });
});
