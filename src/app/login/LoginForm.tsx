"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button, Input, Notice } from "@/components/ui";
import { AlertIcon, GoogleIcon, MailIcon } from "@/components/ui/icons";
import { otpErrorMessage, validateEmail } from "@/lib/auth/messages";
import { useT } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";

/** Matches Supabase's default 60-second limit between magic links. */
export const RESEND_SECONDS = 60;

/** 45 → "0:45", 60 → "1:00". */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

type Mode = "start" | "email" | "sent";

type Props = {
  /** Same-site path to return to after sign-in (already sanitized). */
  next: string;
  /** A sign-in error to show (other than a failed link). */
  initialError?: string;
  /** ?error=link (from /auth/confirm) or ?error=auth (from /auth/callback): the amber "link didn't work" state. */
  linkFailed?: boolean;
};

/**
 * Sign in (D22): the sheet at the bottom of the ink screen. Four states on
 * one route: start (Google, or "Use email instead"), email, sent, and link
 * failed (start with the amber alert). The auth calls are unchanged: Google
 * OAuth and the email magic link, both returning to window.location.origin
 * with ?next=.
 */
export function LoginForm({ next, initialError, linkFailed = false }: Props) {
  const t = useT();
  const emailId = useId();
  const [mode, setMode] = useState<Mode>("start");
  const [showLinkFailed, setShowLinkFailed] = useState(linkFailed);
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
  // Focus the email field when the email state opens from a tap (not on first load).
  const focusEmail = useRef(false);
  const submitRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (resendAt <= now) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resendAt, now]);

  useEffect(() => {
    if (mode !== "email") return;
    if (focusEmail.current) {
      focusEmail.current = false;
      document.getElementById(emailId)?.focus();
    }
    // When the keyboard opens (the layout shrinks: interactive-widget=resizes-content),
    // keep the main button in view under the focused field.
    const keepButtonInView = () => {
      if (document.activeElement?.id === emailId) submitRef.current?.scrollIntoView({ block: "nearest" });
    };
    window.addEventListener("resize", keepButtonInView);
    window.visualViewport?.addEventListener("resize", keepButtonInView);
    return () => {
      window.removeEventListener("resize", keepButtonInView);
      window.visualViewport?.removeEventListener("resize", keepButtonInView);
    };
  }, [mode, emailId]);

  const callbackUrl = (path: string) => `${window.location.origin}${path}?next=${encodeURIComponent(next)}`;

  function go(to: Mode) {
    setError(undefined);
    setEmailError(undefined);
    if (to === "email") focusEmail.current = true;
    if (to !== "start") setShowLinkFailed(false);
    setMode(to);
  }

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
      setMode("sent");
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

  const errorNotice = error && (
    <Notice kind="error" className="mb-3">
      {error}
    </Notice>
  );

  return (
    <div data-login-state={mode === "start" && showLinkFailed ? "link-failed" : mode}>
      {/* Polite announcement of the sent state (the sheet's content changes in place). */}
      <p className="sr-only" aria-live="polite">
        {mode === "sent" && sentTo ? t.auth.sentAnnounce(sentTo) : ""}
      </p>

      {mode === "start" && (
        <>
          {showLinkFailed ? (
            <div role="alert" className="mb-4 flex gap-2.5 rounded-control bg-warn px-3.5 py-3 text-warn">
              <AlertIcon className="mt-0.5 size-5 shrink-0" />
              <div>
                <p className="text-body font-semibold">{t.auth.linkFailedTitle}</p>
                <p className="mt-0.5 text-sm">{t.auth.linkFailedBody}</p>
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-body font-semibold">{t.auth.sheetTitle}</h2>
              <p className="mt-1 mb-4 text-sm text-muted">{t.auth.sheetLead}</p>
            </>
          )}
          {errorNotice}
          <Button size="lg" fullWidth onClick={() => void signInWithGoogle()} disabled={googleLoading}>
            <span className="flex size-[22px] items-center justify-center rounded-full bg-surface">
              <GoogleIcon className="size-3.5" />
            </span>
            {googleLoading ? t.auth.googleOpening : t.auth.google}
          </Button>
          <Button variant="ghost" size="md" fullWidth className="mt-1.5" onClick={() => go("email")}>
            {showLinkFailed ? t.auth.newLink : t.auth.useEmail}
          </Button>
          <p className="mt-2.5 text-center text-xs text-muted">
            {t.auth.legalBefore}
            <Link href="/terms" className="touch-target text-ink underline underline-offset-2">
              {t.auth.terms}
            </Link>
            {t.auth.legalAnd}
            <Link href="/privacy" className="touch-target text-ink underline underline-offset-2">
              {t.auth.privacy}
            </Link>
            {t.auth.legalAfter}
          </p>
        </>
      )}

      {mode === "email" && (
        <form noValidate onSubmit={onSubmit}>
          <h2 className="mb-3.5 text-body font-semibold">{t.auth.emailTitle}</h2>
          <Input
            id={emailId}
            label={t.auth.email}
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            hint={t.auth.emailHint}
            error={emailError}
          />
          <div ref={submitRef} className="mt-3.5 scroll-mb-3">
            {errorNotice}
            <Button type="submit" size="lg" fullWidth disabled={sending}>
              {sending ? t.auth.sending : t.auth.sendLink}
            </Button>
          </div>
          <Button variant="ghost" size="md" fullWidth className="mt-1.5" onClick={() => go("start")}>
            {t.auth.useGoogle}
          </Button>
        </form>
      )}

      {mode === "sent" && sentTo && (
        <div>
          <span className="flex size-11 items-center justify-center rounded-full bg-accent text-on-accent" aria-hidden="true">
            <MailIcon className="size-[22px]" />
          </span>
          <h2 className="mt-3.5 font-display text-xl">{t.auth.checkEmail}</h2>
          <p className="mt-1.5 text-secondary [overflow-wrap:anywhere]">
            {t.auth.sentToBefore}
            <b className="font-semibold text-ink">{sentTo}</b>
            {t.auth.sentToAfter}
          </p>
          <p className="mt-3.5 mb-4 rounded-control bg-surface px-3.5 py-3 text-sm text-secondary">
            {t.auth.sameBrowserBefore}
            <b className="font-semibold text-ink">{t.auth.sameBrowserBold}</b>
            {t.auth.sameBrowserAfter}
          </p>
          {errorNotice}
          <Button
            variant="outline"
            size="lg"
            fullWidth
            disabled={secondsLeft > 0 || sending}
            onClick={() => void sendMagicLink(sentTo)}
          >
            {sending ? t.auth.sending : secondsLeft > 0 ? t.auth.resendIn(formatCountdown(secondsLeft)) : t.auth.resend}
          </Button>
          <Button variant="ghost" size="md" fullWidth className="mt-1.5" onClick={() => go("email")}>
            {t.auth.otherEmail}
          </Button>
        </div>
      )}
    </div>
  );
}
