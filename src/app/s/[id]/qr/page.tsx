import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { BackLink, Card, PageShell } from "@/components/ui";
import { ChevronRightIcon } from "@/components/ui/icons";
import { getCurrentMembership, requireUser } from "@/lib/auth/dal";
import { originFromHeaders } from "@/lib/http/origin";
import { getJoinCode } from "@/lib/queue/data";
import { qrSvg } from "@/lib/queue/qr";
import { getSession } from "@/lib/session/data";
import { ShareActions } from "./ShareActions";

export const metadata: Metadata = {
  title: "Ipakita ang QR · Open Play Queue",
};

const STEPS = [
  "Buksan ang camera ng phone.",
  "Itapat sa QR code.",
  "Pindutin ang link na lalabas. Walang app na kailangan.",
];

export default function QrPage({ params }: PageProps<"/s/[id]/qr">) {
  return (
    <Suspense
      fallback={
        <PageShell>
          <p className="text-muted">Sandali lang…</p>
        </PageShell>
      }
    >
      <QrContent params={params} />
    </Suspense>
  );
}

async function QrContent({ params }: Pick<PageProps<"/s/[id]/qr">, "params">) {
  const { id } = await params;
  const user = await requireUser(`/s/${encodeURIComponent(id)}/qr`);
  const session = await getSession(id);
  if (!session) notFound();
  if (session.status !== "live") redirect(`/s/${session.id}/live`);

  const [code, headerList, membership] = await Promise.all([
    getJoinCode(session.id),
    headers(),
    getCurrentMembership(user.id),
  ]);
  // Settings shows the current club's QR, so link there only for that club's owner.
  const showClubQrLink = membership?.role === "owner" && membership.club.id === session.club_id;
  if (!code) notFound();
  const url = `${originFromHeaders(headerList)}/j/${code}`;
  const svg = await qrSvg(url);

  return (
    <PageShell
      className="print:bg-surface"
      header={
        <div className="flex flex-col gap-1">
          <BackLink href={`/s/${session.id}/live`} className="print:hidden" />
          <h1 className="text-3xl break-words print:pt-8 print:text-center print:text-5xl">{session.name}</h1>
          <p className="text-xl font-semibold print:hidden">I-scan para pumila</p>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <Card className="flex flex-col items-center gap-4 print:border-0 print:shadow-none">
          <div
            role="img"
            aria-label={`QR code ng link para pumila: ${url}`}
            className="w-full max-w-72 print:max-w-[12cm] [&_svg]:h-auto [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <p className="text-center print:text-2xl">
            <span className="text-muted">Join code</span>
            <br />
            <span className="font-display text-5xl font-bold tracking-[0.2em]" aria-label={code.split("").join(" ")}>
              {code}
            </span>
          </p>
        </Card>

        <ol className="flex flex-col gap-2 print:hidden">
          {STEPS.map((step, index) => (
            <li key={step} className="flex gap-3">
              <span className="font-display font-semibold">{index + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        <div className="flex flex-col gap-1 rounded-control bg-subtle px-4 py-3 print:hidden">
          <p className="text-muted">O pumunta sa:</p>
          <p className="font-semibold break-all">{url}</p>
        </div>

        <ShareActions url={url} sessionName={session.name} />

        {showClubQrLink && (
          <Link
            href="/settings#club-qr-heading"
            className="flex min-h-12 items-center justify-center gap-1 self-center rounded-control px-3 text-center font-semibold underline underline-offset-2 focus-visible:outline-3 focus-visible:outline-focus print:hidden"
          >
            May permanenteng QR ang club
            <ChevronRightIcon className="size-5 shrink-0" />
          </Link>
        )}
      </div>
    </PageShell>
  );
}
