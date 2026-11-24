import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { SessionStatusLabel } from "@/components/session/SessionStatusLabel";
import { BackLink, Card, Notice, PageShell } from "@/components/ui";
import { requireUser } from "@/lib/auth/dal";
import { rotationLabel } from "@/lib/club/options";
import { formatCourts, formatGcashNumber, formatPeso } from "@/lib/format";
import { getSession, type Session } from "@/lib/session/data";
import { formatDay, formatSchedule, formatTime } from "@/lib/session/time";
import { SessionControls } from "./SessionControls";

export const metadata: Metadata = {
  title: "Session · Open Play Queue",
};

/** Session page. Phase 2 placeholder: details, status and start/end; the queue arrives in Phase 3. */
export default function SessionPage({ params }: PageProps<"/s/[id]/live">) {
  return (
    <Suspense
      fallback={
        <PageShell header={<BackLink href="/" />}>
          <p className="text-muted">Sandali lang…</p>
        </PageShell>
      }
    >
      <SessionContent params={params} />
    </Suspense>
  );
}

async function SessionContent({ params }: Pick<PageProps<"/s/[id]/live">, "params">) {
  const { id } = await params;
  await requireUser(`/s/${encodeURIComponent(id)}/live`);

  // RLS returns nothing for other clubs' sessions, so they get the same 404 as unknown ids.
  const session = await getSession(id);
  if (!session) notFound();

  const startsAt = new Date(session.starts_at);
  const endsAt = new Date(session.ends_at);

  return (
    <PageShell
      header={
        <div className="flex flex-col gap-2">
          <BackLink href="/" />
          <SessionStatusLabel status={session.status} className="self-start" />
          <h1 className="text-3xl break-words">{session.name}</h1>
          <p className="text-muted">{formatSchedule(startsAt, endsAt)}</p>
        </div>
      }
    >
      <div className="flex flex-col gap-5 pt-2">
        <StatusNote session={session} />
        <SessionControls sessionId={session.id} status={session.status} />
        <Details session={session} />
      </div>
    </PageShell>
  );
}

function StatusNote({ session }: { session: Session }) {
  if (session.status === "draft") {
    return <Notice kind="info">Draft pa ito. Hindi pa bukas ang check-in.</Notice>;
  }
  if (session.status === "live") {
    return (
      <Notice kind="info">
        Live na ang session. Darating dito ang pila at mga court sa susunod na update.
      </Notice>
    );
  }
  const endedAt = session.ended_at ? new Date(session.ended_at) : null;
  return (
    <Notice kind="success">
      Tapos na ang session na ito{endedAt ? ` (${formatDay(endedAt)}, ${formatTime(endedAt)})` : ""}. Sarado
      na ang check-in at hindi na ito mababago.
    </Notice>
  );
}

function Details({ session }: { session: Session }) {
  const gcash = session.gcash_number
    ? `${session.gcash_name ? `${session.gcash_name} · ` : ""}${formatGcashNumber(session.gcash_number)}`
    : "Wala";

  return (
    <Card padding="none">
      <h2 className="sr-only">Detalye ng session</h2>
      <dl className="flex flex-col divide-y divide-default">
        <Row term="Courts">{formatCourts(session.courts_count)}</Row>
        <Row term="Hanggang">{session.points_to} points</Row>
        <Row term="Pagkatapos ng laro">{rotationLabel(session.rotation)}</Row>
        <Row term="Bayad muna bago pumila">{session.pay_first ? "Oo" : "Hindi"}</Row>
        <Row term="Bayad bawat player">{formatPeso(session.fee)}</Row>
        <Row term="GCash">{gcash}</Row>
      </dl>
    </Card>
  );
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3.5">
      <dt className="text-muted">{term}</dt>
      <dd className="text-right font-semibold [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}
