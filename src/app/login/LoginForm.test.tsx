import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const signInWithOtp = vi.fn();
const signInWithOAuth = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithOtp, signInWithOAuth } }),
}));

import { formatCountdown, LoginForm } from "./LoginForm";

beforeEach(() => {
  signInWithOtp.mockReset();
  signInWithOAuth.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

const openEmail = () => userEvent.click(screen.getByRole("button", { name: "Use email instead" }));

describe("LoginForm (D22)", () => {
  it("starts with one main action (Google), Use email instead and the legal links", () => {
    render(<LoginForm next="/" />);
    expect(screen.getByRole("heading", { name: "Sign in to run your club" })).toBeVisible();
    expect(screen.getByText("For organizers. Players just scan the QR at the court.")).toBeVisible();
    expect(screen.getByRole("button", { name: /Continue with Google/ })).toBeVisible();
    expect(screen.getByRole("button", { name: "Use email instead" })).toBeVisible();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("default → email (field focused, email attributes) → back to Google", async () => {
    render(<LoginForm next="/" />);
    await openEmail();
    const field = screen.getByLabelText("Email");
    expect(field).toHaveFocus();
    expect(field).toHaveAttribute("type", "email");
    expect(field).toHaveAttribute("autocomplete", "email");
    expect(field).toHaveAttribute("inputmode", "email");
    expect(field).toHaveAccessibleDescription("We'll email you a link. No password needed.");
    expect(screen.getByRole("button", { name: "Email me a sign-in link" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Use Google instead" }));
    expect(screen.getByRole("button", { name: /Continue with Google/ })).toBeVisible();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
  });

  it("validates the email before calling Supabase", async () => {
    render(<LoginForm next="/" />);
    await openEmail();
    await userEvent.type(screen.getByLabelText("Email"), "juan");
    await userEvent.click(screen.getByRole("button", { name: "Email me a sign-in link" }));
    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription(
      "We'll email you a link. No password needed. That email doesn't look right. E.g. juan@gmail.com",
    );
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("sends the magic link with the confirm URL and next path, then shows Check your email (announced)", async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    render(<LoginForm next="/invite/abc" />);
    await openEmail();
    await userEvent.type(screen.getByLabelText("Email"), " tito@gmail.com ");
    await userEvent.click(screen.getByRole("button", { name: "Email me a sign-in link" }));

    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "tito@gmail.com",
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm?next=%2Finvite%2Fabc` },
    });
    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeVisible();
    expect(screen.getByText("tito@gmail.com")).toBeVisible();
    expect(screen.getByText(/It works once and expires in 1 hour\./)).toBeVisible();
    const live = document.querySelector('[aria-live="polite"]');
    expect(live).toHaveTextContent("Check your email. We sent a sign-in link to tito@gmail.com.");
  });

  it("sent → Use a different email goes back to the email state, keeps the address and focuses it", async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    render(<LoginForm next="/" />);
    await openEmail();
    await userEvent.type(screen.getByLabelText("Email"), "tito@gmail.com");
    await userEvent.click(screen.getByRole("button", { name: "Email me a sign-in link" }));
    await screen.findByRole("heading", { name: "Check your email" });
    await userEvent.click(screen.getByRole("button", { name: "Use a different email" }));
    const field = screen.getByLabelText("Email");
    expect(field).toHaveValue("tito@gmail.com");
    expect(field).toHaveFocus();
  });

  it("counts down 'Resend link in 1:00' and enables 'Resend link' after 60 seconds", async () => {
    vi.useFakeTimers();
    signInWithOtp.mockResolvedValue({ error: null });
    render(<LoginForm next="/" />);
    fireEvent.click(screen.getByRole("button", { name: "Use email instead" }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "tito@gmail.com" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Email me a sign-in link" }));
    });

    expect(screen.getByRole("button", { name: "Resend link in 1:00" })).toBeDisabled();
    await act(async () => {
      for (let i = 0; i < 15; i++) await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByRole("button", { name: "Resend link in 0:45" })).toBeDisabled();
    await act(async () => {
      for (let i = 0; i < 44; i++) await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByRole("button", { name: "Resend link in 0:01" })).toBeDisabled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByRole("button", { name: "Resend link" })).toBeEnabled();
  });

  it("shows the 'try Google' message when Supabase refuses the email (rate limit, not allowed)", async () => {
    signInWithOtp.mockResolvedValue({
      error: { status: 400, code: "email_address_not_authorized", message: "Email address not authorized" },
    });
    render(<LoginForm next="/" />);
    await openEmail();
    await userEvent.type(screen.getByLabelText("Email"), "tito@gmail.com");
    await userEvent.click(screen.getByRole("button", { name: "Email me a sign-in link" }));
    expect(await screen.findByText("We can't send a sign-in link right now. Try Google instead.")).toBeVisible();
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

  it("a failed link (?error=link or auth) shows the amber alert, Google, and Send a new email link → email", async () => {
    render(<LoginForm next="/" linkFailed />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("That sign-in link didn't work");
    expect(alert).toHaveTextContent("It expired or was already used. Get a new one, or sign in with Google.");
    expect(screen.getByRole("button", { name: /Continue with Google/ })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Use email instead" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Send a new email link" }));
    expect(screen.getByLabelText("Email")).toHaveFocus();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows any other error passed from the auth routes", () => {
    render(<LoginForm next="/" initialError="Sign-in didn't finish. Try again." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Sign-in didn't finish. Try again.");
  });

  it("formats the countdown as m:ss", () => {
    expect(formatCountdown(60)).toBe("1:00");
    expect(formatCountdown(45)).toBe("0:45");
    expect(formatCountdown(9)).toBe("0:09");
    expect(formatCountdown(0)).toBe("0:00");
  });
});
