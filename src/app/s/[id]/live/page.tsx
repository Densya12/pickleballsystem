import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { SessionStatusLabel } from "@/components/session/SessionStatusLabel";
import { SaveAsMember } from "@/components/session/SaveAsMember";
import { BackLink, Button, buttonClassName, Card, FeedbackLink, Notice, PageShell } from "@/components/ui";
import { DownloadIcon } from "@/components/ui/icons";
import { requireUser } from "@/lib/auth/dal";
import { rotationLabel } from "@/lib/club/options";
import { formatCourts, formatGcashNumber, formatPeso } from "@/lib/format";
import { getLiveState } from "@/lib/queue/data";
import { walkInBanner } from "@/lib/queue/messages";
import { getSession, type Session } from "@/lib/session/data";
import { courtFormatLabel } from "@/lib/session/validation";
import { getSummaryData } from "@/lib/summary/data";
import { formatDuration, sessionSummary } from "@/lib/summary/summary";
import { formatDay, formatSchedule, formatTime } from "@/lib/session/time";
import { LiveView } from "./LiveView";
import { SessionControls } from "./SessionControls";
import { UnpaidList } from "./UnpaidList";

export const metadata: Metadata = {
  title: "Session · Open Play Queue",
};

/** Session page: the Live screen while live; details and start/delete for drafts; "Buod ng session" when ended. */
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

  if (session.status === "ended") return <Summary session={session} />;

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

/** "Buod ng session": what happened, who still owes, and the export. */
async function Summary({ session }: { session: Session }) {
  const { players, gamesCount } = await getSummaryData(session.id);
  const summary = sessionSummary({
    startedAt: session.started_at,
    endedAt: session.ended_at,
    fee: session.fee,
    players,
    gamesCount,
  });
  // The planned date and time; "Tagal" is how long it actually ran (started → ended).
  const startsAt = new Date(session.starts_at);
  const endsAt = new Date(session.ends_at);
  const { payments } = summary;

  return (
    <PageShell
      header={
        <div className="flex flex-col gap-2">
          <BackLink href="/" />
          <SessionStatusLabel status={session.status} className="self-start" />
          <p className="text-muted [overflow-wrap:anywhere]">{session.name}</p>
          <h1 className="text-3xl">Buod ng session</h1>
          <p className="text-muted">{formatSchedule(startsAt, endsAt)}</p>
        </div>
      }
    >
      <div className="flex flex-col gap-6 pt-2">
        <dl className="grid grid-cols-2 gap-3">
          <Stat label="Tagal">{summary.durationMinutes === null ? "—" : formatDuration(summary.durationMinutes)}</Stat>
          <Stat label="Courts">{session.courts_count}</Stat>
          <Stat label="Players">{summary.playerCount}</Stat>
          <Stat label="Kabuuang laro">{summary.totalGames}</Stat>
        </dl>

        {/* A plain link: a file download, not a page. */}
        <a href={`/s/${session.id}/export`} download className={buttonClassName({ size: "lg", fullWidth: true })}>
          <DownloadIcon />
          I-download (Excel)
        </a>

        {session.fee > 0 && (
          <section aria-labelledby="summary-payments-heading" className="flex flex-col gap-3">
            <h2 id="summary-payments-heading" className="text-2xl">
              Bayad
            </h2>
            <Card className="flex flex-col gap-1">
              <p className="font-display text-3xl font-semibold">
                {formatPeso(payments.confirmedTotal)}{" "}
                <span className="text-xl text-muted">sa {formatPeso(payments.expectedTotal)}</span>
              </p>
              <p className="font-semibold" data-testid="summary-payment-counts">
                {payments.confirmed.length} bayad · {payments.pending.length} i-check · {payments.unpaid.length} hindi pa
              </p>
            </Card>
            {payments.unpaid.length > 0 ? (
              <>
                <h3 className="text-xl">Hindi pa bayad ({payments.unpaid.length})</h3>
                <UnpaidList
                  players={payments.unpaid.map((p) => ({ id: p.id, name: p.name }))}
                  session={{ name: session.name, fee: session.fee, gcashName: session.gcash_name, gcashNumber: session.gcash_number }}
                />
              </>
            ) : (
              <p className="rounded-card border border-dashed border-strong px-5 py-4 text-muted">Bayad na ang lahat.</p>
            )}
            {payments.pending.length > 0 && (
              <Button href={`/s/${session.id}/payments`} variant="secondary" fullWidth>
                I-check ang {payments.pending.length} GCash sa Bayad
              </Button>
            )}
          </section>
        )}

        <section aria-labelledby="games-per-player-heading" className="flex flex-col gap-3">
          <h2 id="games-per-player-heading" className="text-2xl">
            Laro bawat player
          </h2>
          {summary.gamesPerPlayer.length > 0 ? (
            <ol className="flex flex-col divide-y divide-default rounded-card border border-default bg-surface">
              {summary.gamesPerPlayer.map((player) => (
                <li key={player.id} aria-label={player.name} className="flex flex-col gap-2 px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">{player.name}</span>
                    <span className="shrink-0 font-display text-xl font-semibold" data-testid="games-played">
                      {player.gamesPlayed} laro
                    </span>
                  </div>
                  <SaveAsMember
                    sessionId={session.id}
                    playerId={player.id}
                    playerName={player.name}
                    isMember={player.memberId !== null}
                  />
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-card border border-dashed border-strong px-5 py-4 text-muted">
              Walang naglaro sa session na ito. Sa susunod, ipakita ang QR o magdagdag ng walk-in.
            </p>
          )}
        </section>

        <Details session={session} />
        <FeedbackLink />
      </div>
    </PageShell>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col rounded-card border border-default bg-surface px-4 py-3 shadow-card">
      <dt className="text-muted">{label}</dt>
      <dd className="font-display text-2xl font-semibold">{children}</dd>
    </div>
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
    <Card padding="none" role="region" aria-label="Detalye ng session">
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
