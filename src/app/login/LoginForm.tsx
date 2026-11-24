"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button, Card, Input, Notice } from "@/components/ui";
import { GoogleIcon, MailIcon } from "@/components/ui/icons";
import { AUTH_MESSAGES, otpErrorMessage, validateEmail } from "@/lib/auth/messages";
import { createClient } from "@/lib/supabase/client";

/** Matches Supabase's default 60-second limit between magic links. */
export const RESEND_SECONDS = 60;

type Props = {
  /** Same-site path to return to after sign-in (already sanitized). */
  next: string;
  initialError?: string;
};

export function LoginForm({ next, initialError }: Props) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string>();
  const [error, setError] = useState(initialError);
  const [sending, setSending] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  // Deadline-based countdown: background tabs throttle timers (e.g. while the
  // organizer checks their email app), so derive the remaining time from the
  // clock instead of counting ticks.
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(0);
  const secondsLeft = Math.max(0, Math.ceil((resendAt - now) / 1000));

  useEffect(() => {
    if (resendAt <= now) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resendAt, now]);

  const callbackUrl = (path: string) =>
    `${window.location.origin}${path}?next=${encodeURIComponent(next)}`;

  async function signInWithGoogle() {
    setError(undefined);
    setGoogleLoading(true);
    try {
      const { error: oauthError } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callbackUrl("/auth/callback") },
      });
      // On success the browser navigates to Google, so only errors land here.
      if (oauthError) throw oauthError;
    } catch {
      setError(AUTH_MESSAGES.googleFailed);
      setGoogleLoading(false);
    }
  }

  async function sendMagicLink(address: string) {
    setError(undefined);
    setSending(true);
    try {
      const { error: otpError } = await createClient().auth.signInWithOtp({
        email: address,
        options: { emailRedirectTo: callbackUrl("/auth/confirm") },
      });
      if (otpError) {
        setError(otpErrorMessage(otpError));
        return;
      }
      const sentAt = Date.now();
      setSentTo(address);
      setNow(sentAt);
      setResendAt(sentAt + RESEND_SECONDS * 1000);
    } catch {
      setError(AUTH_MESSAGES.emailFailed);
    } finally {
      setSending(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = validateEmail(email);
    setEmailError(problem);
    if (!problem) void sendMagicLink(email.trim());
  }

  if (sentTo) {
    return (
      <Card className="mt-4 flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <MailIcon className="mt-1 size-6 shrink-0" />
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl">I-check ang email mo</h2>
            <p>
              Pinadala namin ang login link sa <strong className="break-all">{sentTo}</strong>. Buksan
              ito para makapasok.
            </p>
          </div>
        </div>
        {error && <Notice kind="error">{error}</Notice>}
        <Button
          variant="secondary"
          fullWidth
          disabled={secondsLeft > 0 || sending}
          onClick={() => void sendMagicLink(sentTo)}
        >
          {sending ? "Pinapadala…" : "Ipadala ulit"}
        </Button>
        {secondsLeft > 0 && (
          <p className="text-muted">Pwede nang ipadala ulit pagkalipas ng {secondsLeft} segundo.</p>
        )}
        <Button
          variant="secondary"
          fullWidth
          onClick={() => {
            setSentTo(null);
            setError(undefined);
          }}
        >
          Gumamit ng ibang email
        </Button>
      </Card>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-5">
      {error && <Notice kind="error">{error}</Notice>}

      <Button size="lg" fullWidth onClick={() => void signInWithGoogle()} disabled={googleLoading}>
        <span className="flex size-7 items-center justify-center rounded-full bg-surface">
          <GoogleIcon className="size-5" />
        </span>
        {googleLoading ? "Binubuksan ang Google…" : "Mag-sign in gamit ang Google"}
      </Button>

      <div className="flex items-center gap-3 text-muted" role="separator" aria-label="o">
        <span aria-hidden="true" className="flex-1 border-t border-default" />
        <span aria-hidden="true">o</span>
        <span aria-hidden="true" className="flex-1 border-t border-default" />
      </div>

      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input
          label="Email mo"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="juan@gmail.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={emailError}
        />
        <Button type="submit" variant="secondary" size="lg" fullWidth disabled={sending}>
          {sending ? "Pinapadala…" : "Ipadala ang login link"}
        </Button>
      </form>
    </div>
  );
}
