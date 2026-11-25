import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { BackLink, PageShell } from "@/components/ui";
import { ChevronRightIcon } from "@/components/ui/icons";
import { getCurrentMembership, requireUser } from "@/lib/auth/dal";
import { originFromHeaders } from "@/lib/http/origin";
import { en } from "@/lib/i18n/dictionary";
import { getT } from "@/lib/i18n/server";
import { getJoinCode } from "@/lib/queue/data";
import { qrSvg } from "@/lib/queue/qr";
import { getSession } from "@/lib/session/data";
import { ShareActions } from "./ShareActions";

export const metadata: Metadata = {
  title: `${en.live.qrPageTitle} · ${en.common.appName}`,
};

export default function QrPage({ params }: PageProps<"/s/[id]/qr">) {
  return (
    <Suspense fallback={<PageShell>{null}</PageShell>}>
      <QrContent params={params} />
    </Suspense>
  );
}

async function QrContent({ params }: Pick<PageProps<"/s/[id]/qr">, "params">) {
  const { id } = await params;
  const user = await requireUser(`/s/${encodeURIComponent(id)}/qr`);
  const session = await getSession(id);
  if (!session) notFound();
  if (session.status !== "live") redirect(`/s/${session.id}`);

  const [code, headerList, membership, t] = await Promise.all([
    getJoinCode(session.id),
    headers(),
    getCurrentMembership(user.id),
    getT(),
  ]);
  if (!code) notFound();
  // Settings shows the current club's QR, so link there only for that club's owner.
  const showClubQrLink = membership?.role === "owner" && membership.club.id === session.club_id;
  const url = `${originFromHeaders(headerList)}/j/${code}`;
  const svg = await qrSvg(url);

  return (
    <PageShell
      className="print:bg-surface"
      top={<BackLink href={`/s/${session.id}`} label={t.nav.courts} />}
      title={<span className="print:block print:pt-8 print:text-center print:text-display-court">{session.name}</span>}
      subtitle={<span className="print:hidden">{t.live.scanToJoin}</span>}
      footer={<ShareActions url={url} sessionName={session.name} />}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-3 rounded-card bg-surface p-5">
          <div
            role="img"
            aria-label={t.live.qrAlt(url)}
            className="w-full max-w-64 print:max-w-[12cm] [&_svg]:h-auto [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <p className="text-center">
            <span className="block text-sm text-muted">{t.live.joinCode}</span>
            <span className="font-display text-3xl font-semibold tracking-[0.2em]" aria-label={code.split("").join(" ")}>
              {code}
            </span>
          </p>
        </div>

        <ol className="flex flex-col gap-1 px-1 text-sm text-muted print:hidden">
          {t.live.qrSteps.map((step, index) => (
            <li key={step} className="flex gap-2">
              <span className="font-semibold text-ink">{index + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        <div className="rounded-group bg-surface px-4 py-3 print:hidden">
          <p className="text-sm text-muted">{t.live.orGoTo}</p>
          <p className="font-medium break-all">{url}</p>
        </div>

        {showClubQrLink && (
          <Link
            href="/settings/qr"
            className="flex min-h-11 items-center justify-center gap-1 self-center rounded-control px-3 text-sm font-medium underline underline-offset-2 print:hidden"
          >
            {t.live.clubQrLink}
            <ChevronRightIcon className="size-4" />
          </Link>
        )}
      </div>
    </PageShell>
  );
}
