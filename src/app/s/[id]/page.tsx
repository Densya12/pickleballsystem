import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SaveAsMember } from "@/components/session/SaveAsMember";
import {
  BackLink,
  buttonClassName,
  Button,
  EmptyState,
  FeedbackRow,
  ListGroup,
  Notice,
  PageShell,
  Section,
  Skeleton,
  SkeletonCard,
  SkeletonLine,
  SkeletonRegion,
  StatusChip,
} from "@/components/ui";
import { DownloadIcon } from "@/components/ui/icons";
import { requireUser } from "@/lib/auth/dal";
import { formatPeso } from "@/lib/format";
import { en, type Dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";
import { getLocale, getT } from "@/lib/i18n/server";
import { getLiveState } from "@/lib/queue/data";
import { getSession, type Session } from "@/lib/session/data";
import { formatSchedule } from "@/lib/session/time";
import { getSummaryData } from "@/lib/summary/data";
import { formatDuration, sessionSummary } from "@/lib/summary/summary";
import { CourtsView } from "./_components/CourtsView";
import { DraftControls } from "./_components/DraftControls";
import { LiveHeaderActions, LiveLine } from "./_components/LiveHeader";
import { SessionDetails } from "./_components/SessionDetails";
import { SessionFrame } from "./_components/SessionFrame";
import { UnpaidList } from "./_components/UnpaidList";
import { CourtsSkeleton } from "./_components/SessionSkeletons";

export const metadata: Metadata = {
  title: `${en.nav.session} · ${en.common.appName}`,
};

/** A session: Courts while live (D19), the draft page, or the summary once ended. */
export default function SessionPage({ params }: PageProps<"/s/[id]">) {
  return (
    <Suspense fallback={<CourtsSkeleton />}>
      <SessionContent params={params} />
    </Suspense>
  );
}

async function SessionContent({ params }: Pick<PageProps<"/s/[id]">, "params">) {
  const { id } = await params;
  await requireUser(`/s/${encodeURIComponent(id)}`);
  // RLS returns nothing for other clubs' sessions, so they get the same 404 as unknown ids.
  const session = await getSession(id);
  if (!session) notFound();
  if (session.status === "draft") return <Draft session={session} />;
  if (session.status === "ended") {
    const [t, locale] = await Promise.all([getT(), getLocale()]);
    // The session is known: the summary's header and details are real while its numbers load.
    return (
      <Suspense fallback={<SummarySkeleton session={session} t={t} locale={locale} />}>
        <Summary session={session} />
      </Suspense>
    );
  }
  return (
    <Suspense fallback={<CourtsSkeleton sessionName={session.name} />}>
      <Courts session={session} />
    </Suspense>
  );
}

/** Summary while its numbers load: real header, labels and session details; data as skeleton blocks. */
function SummarySkeleton({ session, t, locale }: { session: Session; t: Dictionary; locale: Locale }) {
  return (
    <PageShell
      top={<BackLink href="/" label={t.nav.home} />}
      eyebrow={<span className="flex items-center gap-2"><StatusChip kind="ended" /> {session.name}</span>}
      title={t.session.summaryTitle}
      subtitle={formatSchedule(new Date(session.starts_at), new Date(session.ends_at), locale)}
      footer={
        <a href={`/s/${session.id}/export`} download className={buttonClassName({ size: "lg", fullWidth: true })}>
          <DownloadIcon className="size-[18px]" />
          {t.session.download}
        </a>
      }
    >
      <SkeletonRegion className="flex flex-col gap-5">
        <dl className="skeleton-card grid grid-cols-2 overflow-hidden rounded-card bg-surface">
          {[t.session.duration, t.session.detailCourts, t.session.playersStat, t.session.gamesStat].map((label, index) => (
            <div key={label} className={`flex flex-col px-4 py-3 ${index % 2 === 0 ? "border-r border-hairline" : ""} ${index < 2 ? "border-b border-hairline" : ""}`}>
              <dt className="text-sm text-muted">{label}</dt>
              <dd>{index === 1 ? <span className="font-display text-2xl font-semibold">{session.courts_count}</span> : <SkeletonLine size="2xl" width={56} />}</dd>
            </div>
          ))}
        </dl>
        {session.fee > 0 && (
          <Section id="summary-payments-loading" label={t.payments.title}>
            <SkeletonCard>
              <SkeletonLine size="2xl" width={130} />
              <Skeleton height={6} rounded="full" className="mt-3 w-full" />
              <SkeletonLine size="sm" width="78%" className="mt-2.5" />
            </SkeletonCard>
          </Section>
        )}
        <Section id="games-per-player-loading" label={t.session.gamesPerPlayer}>
          <ListGroup className="skeleton-card">
            {[58, 46, 64, 50].map((w) => (
              <li key={w} className="flex flex-col gap-1.5 px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <SkeletonLine width={`${w}%`} />
                  <SkeletonLine size="sm" width={56} />
                </div>
                <Skeleton width={128} height={36} rounded="full" />
              </li>
            ))}
          </ListGroup>
        </Section>
        <Section id="summary-details-loading" label={t.session.details}>
          <SessionDetails session={session} t={t} framed />
        </Section>
      </SkeletonRegion>
    </PageShell>
  );
}

async function Courts({ session }: { session: Session }) {
  const [state, t] = await Promise.all([getLiveState(session.id), getT()]);
  return (
    <SessionFrame
      session={{ id: session.id, fee: session.fee }}
      tab="courts"
      title={session.name}
      subtitle={<LiveLine playing={state.playingCount} waiting={state.queue.length} t={t} />}
      actions={<LiveHeaderActions sessionId={session.id} t={t} />}
      courts={state.courts}
      queueCount={state.queue.length}
      paymentsBadge={state.payments.toCheck + state.payments.unpaid}
      details={<SessionDetails session={session} t={t} />}
    >
      <CourtsView state={state} rotation={session.rotation} rules={{ payFirst: session.pay_first, fee: session.fee }} />
    </SessionFrame>
  );
}

async function Draft({ session }: { session: Session }) {
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  return (
    <PageShell
      top={<BackLink href="/" label={t.nav.home} />}
      eyebrow={<StatusChip kind="draft" />}
      title={session.name}
      subtitle={formatSchedule(new Date(session.starts_at), new Date(session.ends_at), locale)}
      footer={<DraftControls sessionId={session.id} />}
    >
      <div className="flex flex-col gap-4">
        <Notice kind="info">{t.session.draftNote}</Notice>
        <SessionDetails session={session} t={t} framed />
      </div>
    </PageShell>
  );
}

/** Summary: what happened, who still owes, and the export. */
async function Summary({ session }: { session: Session }) {
  const [{ players, gamesCount }, t, locale] = await Promise.all([getSummaryData(session.id), getT(), getLocale()]);
  const summary = sessionSummary({ startedAt: session.started_at, endedAt: session.ended_at, fee: session.fee, players, gamesCount });
  const { payments } = summary;
  const counted = payments.counted.length || 1;

  return (
    <PageShell
      top={<BackLink href="/" label={t.nav.home} />}
      eyebrow={<span className="flex items-center gap-2"><StatusChip kind="ended" /> {session.name}</span>}
      title={t.session.summaryTitle}
      subtitle={formatSchedule(new Date(session.starts_at), new Date(session.ends_at), locale)}
      footer={
        // A plain link: a file download, not a page.
        <a href={`/s/${session.id}/export`} download className={buttonClassName({ size: "lg", fullWidth: true })}>
          <DownloadIcon className="size-[18px]" />
          {t.session.download}
        </a>
      }
    >
      <div className="flex flex-col gap-5">
        <dl className="grid grid-cols-2 overflow-hidden rounded-card bg-surface">
          {[
            [t.session.duration, summary.durationMinutes === null ? "—" : formatDuration(summary.durationMinutes, t)],
            [t.session.detailCourts, String(session.courts_count)],
            [t.session.playersStat, String(summary.playerCount)],
            [t.session.gamesStat, String(summary.totalGames)],
          ].map(([label, value], index) => (
            <div key={label} className={`flex flex-col px-4 py-3 ${index % 2 === 0 ? "border-r border-hairline" : ""} ${index < 2 ? "border-b border-hairline" : ""}`}>
              <dt className="text-sm text-muted">{label}</dt>
              <dd className="font-display text-2xl font-semibold">{value}</dd>
            </div>
          ))}
        </dl>

        {session.fee > 0 && (
          <Section id="summary-payments" label={t.payments.title}>
            <div className="rounded-card bg-surface p-4">
              <p className="flex items-baseline gap-1.5">
                <span className="font-display text-2xl leading-none font-semibold">{formatPeso(payments.confirmedTotal)}</span>
                <span className="text-sm text-muted">{t.payments.ofTotal(formatPeso(payments.expectedTotal))}</span>
              </p>
              <div className="mt-3 flex h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "#eeeeea" }} aria-hidden="true">
                <div className="bg-live" style={{ width: `${(payments.confirmed.length / counted) * 100}%` }} />
                <div className="bg-accent" style={{ width: `${(payments.pending.length / counted) * 100}%` }} />
              </div>
              <p className="mt-2.5 text-sm text-muted" data-testid="summary-payment-counts">
                {t.payments.summaryLine(payments.confirmed.length, payments.pending.length, payments.unpaid.length, formatPeso(session.fee))}
              </p>
            </div>
            {payments.pending.length > 0 && (
              <Button href={`/s/${session.id}/payments`} variant="secondary" size="md" fullWidth className="mt-2">
                {t.session.checkPending(payments.pending.length)}
              </Button>
            )}
          </Section>
        )}

        {session.fee > 0 && payments.unpaid.length > 0 && (
          <Section id="summary-unpaid" label={t.payments.unpaid}>
            <UnpaidList
              players={payments.unpaid.map((p) => ({ id: p.id, name: p.name }))}
              session={{ name: session.name, fee: session.fee, gcashName: session.gcash_name, gcashNumber: session.gcash_number }}
            />
          </Section>
        )}

        <Section id="games-per-player" label={t.session.gamesPerPlayer}>
          {summary.gamesPerPlayer.length > 0 ? (
            <ListGroup>
              {summary.gamesPerPlayer.map((player) => (
                <li key={player.id} aria-label={player.name} className="flex flex-col gap-1.5 px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 font-medium [overflow-wrap:anywhere]">{player.name}</span>
                    <span className="shrink-0 text-sm text-muted" data-testid="games-played">
                      {t.session.gamesCount(player.gamesPlayed)}
                    </span>
                  </div>
                  <SaveAsMember sessionId={session.id} playerId={player.id} playerName={player.name} isMember={player.memberId !== null} compact />
                </li>
              ))}
            </ListGroup>
          ) : (
            <EmptyState>{t.session.nobodyPlayed}</EmptyState>
          )}
        </Section>

        <Section id="summary-details" label={t.session.details}>
          <SessionDetails session={session} t={t} framed />
        </Section>

        <ListGroup className="empty:hidden">
          <FeedbackRow label={t.common.feedback} />
        </ListGroup>
      </div>
    </PageShell>
  );
}
