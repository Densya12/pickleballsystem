import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { SessionStatusLabel } from "@/components/session/SessionStatusLabel";
import { BackLink, Card, Notice, PageShell } from "@/components/ui";
import { requireUser } from "@/lib/auth/dal";
import { rotationLabel } from "@/lib/club/options";
import { formatCourts, formatGcashNumber, formatPeso } from "@/lib/format";
import { getLiveState } from "@/lib/queue/data";
import { walkInBanner } from "@/lib/queue/messages";
import { getSession, type Session } from "@/lib/session/data";
import { courtFormatLabel } from "@/lib/session/validation";
import { formatDay, formatSchedule, formatTime } from "@/lib/session/time";
import { LiveView } from "./LiveView";
import { SessionControls } from "./SessionControls";

export const metadata: Metadata = {
  title: "Session · Open Play Queue",
};

/** Session page: the Live screen while live; details and start/delete for drafts; read-only when ended. */
export default function SessionPage({ params, searchParams }: PageProps<"/s/[id]/live">) {
  return (
    <Suspense
      fallback={
        <PageShell header={<BackLink href="/" />}>
          <p className="text-muted">Sandali lang…</p>
        </PageShell>
      }
    >
      <SessionContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function SessionContent({ params, searchParams }: Pick<PageProps<"/s/[id]/live">, "params" | "searchParams">) {
  const { id } = await params;
  await requireUser(`/s/${encodeURIComponent(id)}/live`);

  // RLS returns nothing for other clubs' sessions, so they get the same 404 as unknown ids.
  const session = await getSession(id);
  if (!session) notFound();

  if (session.status === "live") {
    const [state, { added }] = await Promise.all([getLiveState(session.id), searchParams]);
    // Banner after adding a walk-in (that page redirects here with ?added=<player id>).
    const addedPlayer = typeof added === "string" ? state.queue.find((p) => p.id === added) : undefined;
    const incomingBanner = addedPlayer
      ? { key: addedPlayer.id, text: walkInBanner(addedPlayer.name, addedPlayer.position) }
      : null;
    return (
      <LiveView
        session={{
          id: session.id,
          name: session.name,
          rotation: session.rotation,
          startsAt: session.starts_at,
          endsAt: session.ends_at,
          courtsCount: session.courts_count,
          fee: session.fee,
          payFirst: session.pay_first,
        }}
        state={state}
        incomingBanner={incomingBanner}
      />
    );
  }

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
        <Row term="Doubles o Singles">
          {session.court_formats.map((format, index) => `Court ${index + 1}: ${courtFormatLabel(format)}`).join(" · ")}
        </Row>
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
