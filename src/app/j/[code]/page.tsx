import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LanguageSwitch } from "@/components/i18n/LanguageSwitch";
import { Notice, PageShell } from "@/components/ui";
import { en } from "@/lib/i18n/dictionary";
import { getT } from "@/lib/i18n/server";
import { getCheckinPreview, getLastProfile, getPlayerSessionView } from "@/lib/player/data";
import { normalizeJoinCode } from "@/lib/queue/qr";
import { CheckInForm } from "./CheckInForm";
import { CheckInSkeleton } from "@/components/skeletons/PlayerSkeletons";

export const metadata: Metadata = {
  title: en.player.checkInPageTitle,
};

/**
 * Player check-in from the QR link. Public: nobody signs in just to view it.
 * The anonymous sign-in happens on "Join queue" (CheckInForm).
 */
export default function CheckInPage({ params }: PageProps<"/j/[code]">) {
  return (
    <Suspense fallback={<CheckInSkeleton />}>
      <CheckInContent params={params} />
    </Suspense>
  );
}

const languageTop = (
  <>
    <span />
    <LanguageSwitch />
  </>
);

async function CheckInContent({ params }: Pick<PageProps<"/j/[code]">, "params">) {
  const code = normalizeJoinCode((await params).code);
  const [preview, t] = await Promise.all([code ? getCheckinPreview(code) : Promise.resolve(null), getT()]);
  if (!code || !preview || preview.status !== "live") {
    return (
      <PageShell top={languageTop} title={t.player.closedTitle}>
        <Notice kind="error">{t.player.closed}</Notice>
      </PageShell>
    );
  }

  // Already in line on this phone: go straight to "My place".
  const [view, lastProfile] = await Promise.all([getPlayerSessionView(code), getLastProfile(code)]);
  if (view?.me) redirect(`/j/${code}/me`);

  return (
    <PageShell
      top={languageTop}
      eyebrow={
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-[7px] rounded-full bg-live" />
          {t.player.checkInEyebrow(preview.waiting ?? 0, t.common.courts(preview.courtsCount ?? 0))}
        </span>
      }
      title={preview.name}
    >
      <CheckInForm
        code={code}
        // QA-06: payment details aren't in the public preview; players see and pay on My place after joining.
        payment={{ fee: 0, payFirst: false, gcashName: null, gcashNumber: null }}
        lastProfile={lastProfile}
      />
    </PageShell>
  );
}
