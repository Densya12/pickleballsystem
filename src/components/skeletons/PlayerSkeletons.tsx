"use client";

import { useParams } from "next/navigation";
import { LanguageSwitch } from "@/components/i18n/LanguageSwitch";
import {
  BackLink,
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
import { useT } from "@/lib/i18n/client";

/*
 * First-load skeletons for the players' screens. The EN | TL switch is real.
 * "You're up" has no skeleton of its own: it is drawn from the same data as
 * My place, so the first load shows the My place skeleton and then whichever
 * state the data says (in line, resting, or called).
 */

const languageTop = (
  <>
    <span />
    <LanguageSwitch />
  </>
);

/** Check-in: session line and name, the name/level card, the payment card, Join queue. */
export function CheckInSkeleton() {
  return (
    <PageShell top={languageTop} eyebrow={<SkeletonLine size="inherit" width={140} />} titleSkeleton="74%">
      <SkeletonRegion className="flex flex-col gap-3">
        <SkeletonCard className="flex flex-col gap-4">
          <SkeletonField labelWidth={48} />
          <div className="flex flex-col gap-1.5">
            <SkeletonLine size="sm" width={100} />
            <div className="flex flex-wrap gap-1.5">
              {[78, 104, 88].map((w) => (
                <Skeleton key={w} width={w} height={34} rounded="full" />
              ))}
            </div>
          </div>
        </SkeletonCard>
        <SkeletonCard className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <SkeletonLine width={80} />
            <SkeletonLine width={48} />
          </div>
          <SkeletonLine size="sm" width="62%" />
          <Skeleton height={42} className="w-full" />
          <Skeleton height={60} className="w-full" />
          <SkeletonField labelWidth={130} />
        </SkeletonCard>
        <Skeleton height={52} rounded="button" className="mt-2 w-full" />
      </SkeletonRegion>
    </PageShell>
  );
}

/** My place (in line): the big place number card, Payment and View courts rows, Take a break. */
export function PlaceInLineSkeleton() {
  const t = useT();
  return (
    <PageShell
      top={languageTop}
      eyebrow={<SkeletonLine size="inherit" width={150} />}
      titleSkeleton="42%"
      footer={
        <div className="flex flex-col items-center gap-1">
          <Skeleton height={52} rounded="button" className="w-full" />
          <Skeleton width={120} height={44} rounded="button" />
        </div>
      }
    >
      <SkeletonRegion className="flex flex-col gap-3">
        <div className="skeleton-card flex flex-col items-center rounded-[24px] bg-surface px-5 pt-6 pb-5 text-center">
          <p className="text-sm text-muted">{t.player.yourPlace}</p>
          <SkeletonLine size="display-number" width={64} className="mt-0.5" />
          <Skeleton width={190} height={30} rounded="full" className="mt-3.5" />
          <SkeletonLine size="sm" width="60%" className="mt-4 w-full" />
        </div>
        <ListGroup className="skeleton-card">
          {[0, 1].map((i) => (
            <li key={i} className="flex min-h-12 items-center gap-3 px-4 py-3">
              <SkeletonCircle size={20} />
              <span className="flex min-w-0 flex-1 flex-col">
                <SkeletonLine width={i ? "34%" : "42%"} />
                {i === 0 && <SkeletonLine size="sm" width="64%" />}
              </span>
            </li>
          ))}
        </ListGroup>
      </SkeletonRegion>
    </PageShell>
  );
}

/** Courts (players): court cards, then "Get ready". */
export function PlayerCourtsSkeleton() {
  const t = useT();
  const code = String(useParams<{ code: string }>().code ?? "");
  return (
    <PageShell
      top={
        <>
          <BackLink href={`/j/${code}/me`} label={t.player.backToPlace} />
          <LanguageSwitch />
        </>
      }
      eyebrow={<SkeletonLine size="inherit" width={150} />}
      title={t.player.courtsTitle}
    >
      <SkeletonRegion className="flex flex-col gap-5">
        <div className="flex flex-col gap-2.5">
          {[0, 1].map((i) => (
            <SkeletonCard key={i} padding="p-3.5" className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-3">
                <SkeletonLine size="lg" width={68} />
                <SkeletonLine size="xs" width={80} />
              </div>
              <SkeletonCourt />
            </SkeletonCard>
          ))}
        </div>
        <Section id="get-ready-loading" label={t.player.getReady}>
          <ListGroup className="skeleton-card">
            {[58, 46, 64, 50].map((w) => (
              <li key={w} className="flex items-center gap-3 px-4 py-[11px]">
                <SkeletonCircle size={26} />
                <SkeletonLine width={`${w}%`} />
              </li>
            ))}
          </ListGroup>
        </Section>
      </SkeletonRegion>
    </PageShell>
  );
}
