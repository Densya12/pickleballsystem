import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LanguageSwitch } from "@/components/i18n/LanguageSwitch";
import { Notice, PageShell } from "@/components/ui";
import { getClubEntry } from "@/lib/club/entry";
import { en } from "@/lib/i18n/dictionary";
import { getT } from "@/lib/i18n/server";
import { normalizeJoinCode } from "@/lib/queue/qr";

export const metadata: Metadata = {
  title: `${en.player.checkInPageTitle} · ${en.common.appName}`,
};

/**
 * The club's permanent QR (D18). Public. Opens whichever session is live;
 * otherwise says there is none (or that the code is unknown).
 */
export default function ClubEntryPage({ params }: PageProps<"/c/[code]">) {
  return (
    <Suspense fallback={<PageShell>{null}</PageShell>}>
      <ClubEntryContent params={params} />
    </Suspense>
  );
}

async function ClubEntryContent({ params }: Pick<PageProps<"/c/[code]">, "params">) {
  const code = normalizeJoinCode((await params).code);
  const entry = code ? await getClubEntry(code) : ({ status: "not_found" } as const);
  if (entry.status === "live") redirect(`/j/${entry.joinCode}`);
  const t = await getT();

  return (
    <PageShell
      top={
        <>
          <span />
          <LanguageSwitch />
        </>
      }
      eyebrow={t.system.clubEntryEyebrow}
      title={entry.status === "none" ? entry.clubName : t.common.appName}
    >
      {entry.status === "none" ? (
        <Notice kind="info">{t.system.clubEntryNone}</Notice>
      ) : (
        <Notice kind="error">{t.system.clubEntryNotFound}</Notice>
      )}
    </PageShell>
  );
}
