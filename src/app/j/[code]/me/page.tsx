import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LanguageSwitch } from "@/components/i18n/LanguageSwitch";
import { Notice, PageShell } from "@/components/ui";
import { en } from "@/lib/i18n/dictionary";
import { getT } from "@/lib/i18n/server";
import { getCheckinPreview, getPlayerSessionView } from "@/lib/player/data";
import { normalizeJoinCode } from "@/lib/queue/qr";
import { PlayerView } from "./PlayerView";

export const metadata: Metadata = {
  title: `${en.player.placePageTitle} · ${en.common.appName}`,
};

export default function PwestoPage({ params }: PageProps<"/j/[code]/me">) {
  return (
    <Suspense fallback={<PageShell>{null}</PageShell>}>
      <PwestoContent params={params} />
    </Suspense>
  );
}

async function PwestoContent({ params }: Pick<PageProps<"/j/[code]/me">, "params">) {
  const code = normalizeJoinCode((await params).code);
  if (!code) redirect("/j/invalid");

  const view = await getPlayerSessionView(code);
  if (!view) {
    // Not (or no longer) in this session's queue.
    const preview = await getCheckinPreview(code);
    if (preview.status === "ended") return <Ended />;
    redirect(`/j/${code}`);
  }
  if (view.session.status === "ended") return <Ended />;
  // Staff can read the session but have no row: send them to check-in like anyone else.
  if (!view.me) redirect(`/j/${code}`);

  return <PlayerView code={code} view={view} />;
}

async function Ended() {
  const t = await getT();
  return (
    <PageShell
      top={
        <>
          <span />
          <LanguageSwitch />
        </>
      }
      title={t.player.endedTitle}
    >
      <Notice kind="info">{t.player.endedBody}</Notice>
    </PageShell>
  );
}
