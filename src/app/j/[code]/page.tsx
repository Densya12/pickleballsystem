import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Card, Notice, PageShell } from "@/components/ui";
import { getCheckinPreview, getPlayerSessionView } from "@/lib/player/data";
import { waitingLine } from "@/lib/player/messages";
import { normalizeJoinCode } from "@/lib/queue/qr";
import { formatSchedule } from "@/lib/session/time";
import { CheckInForm } from "./CheckInForm";

export const metadata: Metadata = {
  title: "Pumila · Open Play Queue",
};

/**
 * Player check-in from the QR link. Public: nobody signs in just to view it.
 * The anonymous sign-in happens on "Pumila na" (CheckInForm).
 */
export default function CheckInPage({ params }: PageProps<"/j/[code]">) {
  return (
    <Suspense
      fallback={
        <PageShell>
          <p className="pt-10 text-muted">Sandali lang…</p>
        </PageShell>
      }
    >
      <CheckInContent params={params} />
    </Suspense>
  );
}

async function CheckInContent({ params }: Pick<PageProps<"/j/[code]">, "params">) {
  const code = normalizeJoinCode((await params).code);
  const preview = code ? await getCheckinPreview(code) : null;
  if (!code || !preview || preview.status !== "live") return <Closed />;

  // Already in line on this phone: go straight to "Pwesto sa pila".
  const view = await getPlayerSessionView(code);
  if (view?.me) redirect(`/j/${code}/me`);

  return (
    <PageShell
      header={
        <div className="flex flex-col gap-1 pt-6">
          <p className="text-muted">Pumila sa open play</p>
          <h1 className="text-3xl break-words">{preview.name}</h1>
          <p className="text-muted">{formatSchedule(new Date(preview.startsAt!), new Date(preview.endsAt!))}</p>
          <p className="font-semibold">{waitingLine(preview.waiting ?? 0, preview.courtsCount ?? 0)}</p>
        </div>
      }
    >
      <Card className="mt-2">
        <CheckInForm
          code={code}
          payment={{
            fee: preview.fee,
            payFirst: preview.payFirst,
            gcashName: preview.gcashName,
            gcashNumber: preview.gcashNumber,
          }}
        />
      </Card>
    </PageShell>
  );
}

function Closed() {
  return (
    <PageShell
      header={
        <div className="pt-10">
          <h1 className="text-3xl">Pumila sa open play</h1>
        </div>
      }
    >
      <div className="pt-4">
        <Notice kind="error">Sarado na ang check-in. Tanungin ang organizer kung may bagong QR.</Notice>
      </div>
    </PageShell>
  );
}
