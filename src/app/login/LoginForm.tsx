"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button, Card, Input, Notice } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import { GoogleIcon, MailIcon } from "@/components/ui/icons";
import { otpErrorMessage, validateEmail } from "@/lib/auth/messages";
import { createClient } from "@/lib/supabase/client";

/** Matches Supabase's default 60-second limit between magic links. */
export const RESEND_SECONDS = 60;

type Props = {
  /** Same-site path to return to after sign-in (already sanitized). */
  next: string;
  initialError?: string;
};

export function LoginForm({ next, initialError }: Props) {
  const t = useT();
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
      setError(t.auth.googleFailed);
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
        setError(otpErrorMessage(otpError, t));
        return;
      }
      const sentAt = Date.now();
      setSentTo(address);
      setNow(sentAt);
      setResendAt(sentAt + RESEND_SECONDS * 1000);
    } catch {
      setError(t.auth.emailFailed);
    } finally {
      setSending(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = validateEmail(email, t);
    setEmailError(problem);
    if (!problem) void sendMagicLink(email.trim());
  }

  if (sentTo) {
    return (
      <Card className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <MailIcon className="mt-0.5 size-6 shrink-0" />
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-xl">{t.auth.checkEmail}</h2>
            <p className="[overflow-wrap:anywhere]">{t.auth.sentTo(sentTo)}</p>
          </div>
        </div>
        {error && <Notice kind="error">{error}</Notice>}
        <Button variant="outline" size="md" fullWidth disabled={secondsLeft > 0 || sending} onClick={() => void sendMagicLink(sentTo)}>
          {sending ? t.auth.sending : t.auth.resend}
        </Button>
        {secondsLeft > 0 && <p className="text-sm text-muted">{t.auth.resendIn(secondsLeft)}</p>}
        <Button
          variant="ghost"
          size="md"
          fullWidth
          onClick={() => {
            setSentTo(null);
            setError(undefined);
          }}
        >
          {t.auth.otherEmail}
        </Button>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <Notice kind="error">{error}</Notice>}

      <Button size="lg" fullWidth onClick={() => void signInWithGoogle()} disabled={googleLoading}>
        <span className="flex size-6 items-center justify-center rounded-full bg-surface">
          <GoogleIcon className="size-4" />
        </span>
        {googleLoading ? t.auth.googleOpening : t.auth.google}
      </Button>

      <div className="flex items-center gap-3 text-sm text-muted" role="separator" aria-label={t.auth.or}>
        <span aria-hidden="true" className="flex-1 border-t border-quiet" />
        <span aria-hidden="true">{t.auth.or}</span>
        <span aria-hidden="true" className="flex-1 border-t border-quiet" />
      </div>

      <Card>
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-3">
          <Input
            label={t.auth.email}
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            placeholder={t.auth.emailPlaceholder}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={emailError}
          />
          <Button type="submit" variant="outline" size="md" fullWidth disabled={sending}>
            {sending ? t.auth.sending : t.auth.sendLink}
          </Button>
        </form>
      </Card>
    </div>
  );
}
