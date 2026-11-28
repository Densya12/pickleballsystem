"use client";

import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { SessionTabBar, type SessionTab } from "@/components/nav/SessionTabBar";
import {
  BackLink,
  IconLink,
  ListGroup,
  PageShell,
  Section,
  Skeleton,
  SkeletonCard,
  SkeletonCircle,
  SkeletonCourt,
  SkeletonField,
  SkeletonLine,
  SkeletonRegion,
} from "@/components/ui";
import { DownloadIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { LiveHeaderActions } from "./LiveHeader";

/*
 * First-load skeletons for a live session's screens (D19). The page shell is
 * real: "‹ Home", the QR and "+ Walk-in" buttons and the tab bar links work
 * (the session id comes from the URL). Only data becomes skeleton blocks; the
 * queue count shows once loaded and More waits for the session.
 */

function useSessionId(): string {
  return String(useParams<{ id: string }>().id ?? "");
}

function SessionTabSkeleton({
  tab,
  title,
  titleSkeleton,
  subtitle,
  actions,
  children,
}: {
  tab: SessionTab;
  /** A static title ("Queue"), or the session's name when it is already known. */
  title?: string;
  titleSkeleton?: number | string;
  subtitle?: ReactNode;
  actions: "live" | "payments";
  children: ReactNode;
}) {
  const t = useT();
  const id = useSessionId();
  return (
    <PageShell
      top={
        <>
          <BackLink href="/" label={t.live.homeLink} />
          <div className="flex items-center gap-2">
            {actions === "live" ? (
              <LiveHeaderActions sessionId={id} t={t} />
            ) : (
              <IconLink href={`/s/${id}/export`} label={t.payments.downloadList} prefetch={false}>
                <DownloadIcon className="size-[18px]" />
              </IconLink>
            )}
          </div>
        </>
      }
      title={title}
      titleSkeleton={title ? undefined : titleSkeleton}
      subtitle={subtitle}
      tabBar={<SessionTabBar sessionId={id} current={tab} queueCount={null} paymentsBadge={0} showPayments />}
    >
      <SkeletonRegion className="flex flex-col gap-4">{children}</SkeletonRegion>
    </PageShell>
  );
}

/** Courts: three court cards (title, court, the "Done" pill), then "Up next". */
export function CourtsSkeleton({ sessionName }: { sessionName?: string }) {
  const t = useT();
  return (
    <SessionTabSkeleton
      tab="courts"
      title={sessionName}
      titleSkeleton="72%"
      subtitle={<SkeletonLine size="inherit" width={190} />}
      actions="live"
    >
      <div className="flex flex-col gap-2.5">
        {[0, 1, 2].map((i) => (
          <SkeletonCard key={i} padding="p-3.5" className="flex flex-col gap-2.5">
            {/* Centred, not baseline: two placeholder lines would add ~2px to the row. */}
            <div className="flex items-center justify-between gap-3">
              <SkeletonLine size="lg" width={68} />
              <SkeletonLine size="xs" width={96} />
            </div>
            <SkeletonCourt />
            <div className="flex justify-end">
              <Skeleton width={86} height={40} rounded="full" />
            </div>
          </SkeletonCard>
        ))}
        <p className="flex items-baseline gap-x-2.5 px-1.5 pt-1 text-sm">
          <span className="text-muted">{t.live.upNext}</span>
          <SkeletonLine size="inherit" width={170} />
        </p>
      </div>
    </SessionTabSkeleton>
  );
}

function QueueRows({ count, badge = true, tone }: { count: number; badge?: boolean; tone?: "next" }) {
  return (
    <ListGroup className="skeleton-card">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className={cn("flex min-h-12 items-center gap-3 px-4 py-[11px]", tone === "next" && "bg-accent-faint")}>
          {badge && <SkeletonCircle size={26} />}
          <span className="min-w-0 flex-1">
            <SkeletonLine width={`${[62, 48, 70, 55][i % 4]}%`} />
          </span>
          {badge ? <SkeletonLine size="sm" width={72} /> : <Skeleton width={64} height={24} rounded="full" />}
        </li>
      ))}
    </ListGroup>
  );
}

/** Queue: Up next (4), After that (2), On hold (2). */
export function QueueSkeleton() {
  const t = useT();
  return (
    <SessionTabSkeleton tab="queue" title={t.live.queueTitle} subtitle={<SkeletonLine size="inherit" width={210} />} actions="live">
      <div className="flex flex-col gap-5">
        <Section id="up-next-loading" label={t.live.upNextSection}>
          <QueueRows count={4} tone="next" />
        </Section>
        <Section id="after-that-loading" label={t.live.afterThat}>
          <QueueRows count={2} />
        </Section>
        <Section id="on-hold-loading" label={t.live.onHold}>
          <QueueRows count={2} badge={false} />
        </Section>
      </div>
    </SessionTabSkeleton>
  );
}

function PaymentRows({ withIcon }: { withIcon?: boolean }) {
  return (
    <ListGroup className="skeleton-card">
      {[0, 1].map((i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3">
          <span className="flex min-w-0 flex-1 flex-col">
            <SkeletonLine width={`${i ? 52 : 64}%`} />
            <SkeletonLine size="sm" width={110} />
          </span>
          {withIcon && <SkeletonCircle size={36} />}
          <Skeleton width={withIcon ? 76 : 100} height={36} rounded="full" />
        </li>
      ))}
    </ListGroup>
  );
}

/** Payments: summary card, "to check" and unpaid rows, then the Paid row. */
export function PaymentsSkeleton() {
  const t = useT();
  return (
    <SessionTabSkeleton tab="payments" title={t.payments.title} actions="payments">
      <div className="flex flex-col gap-5">
        <SkeletonCard>
          <div className="flex items-baseline gap-1.5">
            <SkeletonLine size="3xl" width={140} />
            <SkeletonLine size="sm" width={70} />
          </div>
          <Skeleton height={6} rounded="full" className="mt-3 w-full" />
          <SkeletonLine size="sm" width="78%" className="mt-2.5" />
        </SkeletonCard>
        <Section id="check-loading" label={t.status.toCheck}>
          <PaymentRows />
        </Section>
        <Section id="unpaid-loading" label={t.payments.unpaid}>
          <PaymentRows withIcon />
        </Section>
        <div className="skeleton-card flex min-h-12 items-center justify-between rounded-group bg-surface px-4 py-3.5">
          <span className="font-medium">{t.payments.paid}</span>
          <SkeletonLine size="sm" width={28} />
        </div>
      </div>
    </SessionTabSkeleton>
  );
}

/** Walk-in: the form's two cards and its main button. */
export function WalkInSkeleton() {
  const t = useT();
  const id = useSessionId();
  return (
    <PageShell top={<BackLink href={`/s/${id}/queue`} label={t.nav.queue} />} title={t.live.walkInTitle} subtitle={t.live.walkInSubtitle}>
      <SkeletonRegion className="flex flex-col gap-3">
        <SkeletonCard className="flex flex-col gap-4">
          <SkeletonField labelWidth={100} />
          <SkeletonField labelWidth={48} />
          <div className="flex flex-col gap-1.5">
            <SkeletonLine size="sm" width={40} />
            <div className="flex flex-wrap gap-1.5">
              {[78, 104, 88, 80].map((w) => (
                <Skeleton key={w} width={w} height={34} rounded="full" />
              ))}
            </div>
          </div>
        </SkeletonCard>
        <SkeletonCard className="flex flex-col gap-3">
          <SkeletonLine size="sm" width={110} />
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <SkeletonCircle size={20} />
              <SkeletonLine width={`${[40, 30, 36][i]}%`} />
            </div>
          ))}
        </SkeletonCard>
        <Skeleton height={52} rounded="button" className="mt-2 w-full" />
      </SkeletonRegion>
    </PageShell>
  );
}

/** Session QR: the QR card, the steps and the link box; share buttons at the bottom. */
export function SessionQrSkeleton() {
  const t = useT();
  const id = useSessionId();
  return (
    <PageShell
      top={<BackLink href={`/s/${id}`} label={t.nav.courts} />}
      titleSkeleton="64%"
      subtitle={t.live.scanToJoin}
      footer={
        <div className="flex flex-col gap-2">
          <Skeleton height={52} rounded="button" className="w-full" />
          <Skeleton height={44} rounded="button" className="w-full" />
        </div>
      }
    >
      <SkeletonRegion className="flex flex-col gap-4">
        <SkeletonCard padding="p-5" className="flex flex-col items-center gap-3">
          <Skeleton rounded="control" className="aspect-square w-full max-w-64" />
          <div className="flex flex-col items-center">
            <SkeletonLine size="sm" width={64} />
            <SkeletonLine size="3xl" width={150} />
          </div>
        </SkeletonCard>
        <div className="flex flex-col gap-1 px-1">
          {[70, 55, 85].map((w) => (
            <SkeletonLine key={w} size="sm" width={`${w}%`} />
          ))}
        </div>
        <SkeletonCard rounded="group" padding="px-4 py-3">
          <SkeletonLine size="sm" width={60} />
          <SkeletonLine width="80%" />
        </SkeletonCard>
      </SkeletonRegion>
    </PageShell>
  );
}

/** Games & standings (D27): the match log rows and the standings table. */
export function GamesSkeleton() {
  const t = useT();
  const id = useSessionId();
  return (
    <PageShell top={<BackLink href={`/s/${id}`} label={t.nav.courts} />} title={t.games.pageTitle}>
      <SkeletonRegion className="flex flex-col gap-5">
        <Section id="match-log-loading" label={t.games.logTitle}>
          <ListGroup className="skeleton-card">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-3">
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <SkeletonLine size="sm" width="55%" />
                  <SkeletonLine width="80%" />
                  <SkeletonLine size="sm" width="40%" />
                </span>
                <Skeleton width={76} height={36} rounded="full" />
              </li>
            ))}
          </ListGroup>
        </Section>
        <Section id="standings-loading" label={t.games.standingsTitle}>
          <SkeletonLine size="sm" width="85%" className="mx-1 mb-2" />
          <ListGroup className="skeleton-card">
            {[60, 48, 66, 52].map((w) => (
              <li key={w} className="flex items-center gap-3 px-4 py-3">
                <SkeletonLine width={16} />
                <SkeletonLine width={`${w}%`} />
              </li>
            ))}
          </ListGroup>
        </Section>
      </SkeletonRegion>
    </PageShell>
  );
}
