import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { BackLink, Notice, PageShell } from "@/components/ui";
import { requireClub } from "@/lib/auth/dal";
import { originFromHeaders } from "@/lib/http/origin";
import { en } from "@/lib/i18n/dictionary";
import { getT } from "@/lib/i18n/server";
import { qrSvg } from "@/lib/queue/qr";
import { ClubQrCard } from "../ClubQrCard";

export const metadata: Metadata = {
  title: `${en.settings.clubQr} · ${en.common.appName}`,
};

export default function ClubQrPage() {
  return (
    <Suspense fallback={<PageShell>{null}</PageShell>}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const [{ club, role }, headerList, t] = await Promise.all([requireClub("/settings/qr"), headers(), getT()]);
  const url = `${originFromHeaders(headerList)}/c/${club.entry_code}`;
  return (
    <PageShell
      className="print:bg-surface"
      top={<BackLink href="/settings" label={t.settings.title} />}
      title={<span className="print:hidden">{t.settings.clubQr}</span>}
    >
      {role === "owner" ? (
        <ClubQrCard qr={{ url, svg: await qrSvg(url), clubName: club.name }} />
      ) : (
        <Notice kind="info">{t.common.ownerOnly}</Notice>
      )}
    </PageShell>
  );
}
