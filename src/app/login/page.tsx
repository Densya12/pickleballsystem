import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { BallShapes } from "@/components/brand/Ball";
import { Wordmark } from "@/components/brand/Wordmark";
import { MiniCourt } from "@/components/court/MiniCourt";
import { SkeletonLine } from "@/components/ui/Skeleton";
import { loginErrorMessage } from "@/lib/auth/messages";
import { safeNextPath } from "@/lib/auth/paths";
import { BRAND_INK } from "@/lib/brand";
import { en } from "@/lib/i18n/dictionary";
import { getT } from "@/lib/i18n/server";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: en.auth.pageTitle,
};

// The screen is ink. With the keyboard open, shrink the layout (not just the
// visual viewport) so the height rules below hide the court and keep the
// sheet's buttons on screen.
export const viewport: Viewport = {
  themeColor: BRAND_INK,
  interactiveWidget: "resizes-content",
};

/**
 * Sign in (D22, docs/design/v5/N-SignIn*.dc.html): an ink screen with the
 * wordmark, a tilted mini court and the headline; a light sheet at the bottom
 * with the sign-in actions. One flex column (min-h-dvh), nothing positioned
 * over the content: on short screens the court goes first (below 780px
 * tall), then the subline (below 600px, e.g. landscape or the keyboard open).
 */
export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Suspense fallback={<LoginShell hero={<HeroSkeleton />} sheet={<SheetSkeleton />} />}>
      <LoginContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginContent({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const [params, t] = await Promise.all([searchParams, getT()]);
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const code = first(params.error);
  // /auth/confirm sends ?error=link, /auth/callback ?error=auth.
  const linkFailed = code === "link" || code === "auth";
  return (
    <LoginShell
      hero={
        <>
          <DecorativeCourt you={t.player.you} />
          <h1 className="mt-9 font-display text-3xl tracking-[-0.8px] [@media(max-height:779px)]:mt-6">
            {t.auth.headline}
            <span className="block text-accent">{t.auth.headlineAccent}</span>
          </h1>
          <p className="mt-3 max-w-[300px] text-body text-on-dark-muted [@media(max-height:599px)]:hidden">{t.auth.subline}</p>
        </>
      }
      sheet={
        <LoginForm
          next={safeNextPath(first(params.next))}
          linkFailed={linkFailed}
          initialError={linkFailed ? undefined : loginErrorMessage(code, t)}
        />
      }
    />
  );
}

function LoginShell({ hero, sheet }: { hero: ReactNode; sheet: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center bg-primary text-on-primary">
      <div className="flex w-full max-w-app flex-1 flex-col">
        <div className="overflow-x-clip px-6 pt-[max(3.5rem,calc(env(safe-area-inset-top)+1rem))] pb-6 [@media(max-height:699px)]:pt-[max(2rem,env(safe-area-inset-top))] [@media(max-height:699px)]:pb-5 [@media(max-height:599px)]:pt-[max(1rem,env(safe-area-inset-top))] [@media(max-height:599px)]:pb-4">
          <Wordmark tone="dark" className="text-3xl" />
          {hero}
        </div>
        <div className="mt-auto rounded-t-[28px] bg-page px-5 pt-6 pb-[max(1.875rem,calc(env(safe-area-inset-bottom)+1rem))] text-ink [@media(max-height:599px)]:pt-4 [@media(max-height:599px)]:pb-[max(1rem,env(safe-area-inset-bottom))]">
          {sheet}
        </div>
      </div>
    </div>
  );
}

/** The tilted court with Ana, Ben, Jojo and "You", and a ball in play. Decorative. */
function DecorativeCourt({ you }: { you: string }) {
  return (
    <div aria-hidden="true" className="mt-8 -rotate-4 [@media(max-height:779px)]:hidden" data-login-court="">
      <div className="relative">
        <MiniCourt
          format="doubles"
          players={[
            { id: "ana", name: "Ana" },
            { id: "ben", name: "Ben" },
            { id: "jojo", name: "Jojo" },
            { id: "you", name: you, highlight: true },
          ]}
        />
        {/* The ball, as in N-SignIn: x 248–268, y 60–80 of the 440×200 court. */}
        <svg viewBox="0 0 24 24" className="absolute" style={{ left: "56.4%", top: "30%", width: "4.55%" }}>
          <BallShapes />
        </svg>
      </div>
    </div>
  );
}

function HeroSkeleton() {
  return <div className="mt-8 aspect-[440/200] w-full -rotate-4 rounded-control bg-white/10 [@media(max-height:779px)]:hidden" />;
}

function SheetSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <SkeletonLine size="body" width="60%" />
      <SkeletonLine size="sm" width="85%" />
      <div className="h-[52px] rounded-button bg-skeleton" />
    </div>
  );
}
