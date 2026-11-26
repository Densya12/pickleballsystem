import Link from "next/link";
import { Suspense } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { MainTabBar } from "@/components/nav/MainTabBar";
import { Button, EmptyState, ListGroup, ListRow, PageShell, Section } from "@/components/ui";
import { ArrowRightIcon, ChevronRightIcon, PlusIcon, RepeatIcon } from "@/components/ui/icons";
import { requireClub } from "@/lib/auth/dal";
import { formatPeso } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";
import { getLocale, getT } from "@/lib/i18n/server";
import { getLiveState } from "@/lib/queue/data";
import { getHomeSessions, type Session } from "@/lib/session/data";
import { dateBadge, dayPart, formatShortDate, formatTime, formatTimeRange } from "@/lib/session/time";
import { HomeSkeleton } from "@/components/skeletons/OrganizerSkeletons";

/**
 * Home (D19): the live session as a dark card, New session / Repeat last,
 * then upcoming and past sessions. Members and Settings are in the tab bar.
 */
export default function Home() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const [{ user, club }, t, locale] = await Promise.all([requireClub(), getT(), getLocale()]);
  const { live, drafts, ended, endedStats, lastRepeatable } = await getHomeSessions(club.id);
  const liveState = live ? await getLiveState(live.id) : null;
  const firstName = user.name?.split(/\s+/)[0];

  return (
    <PageShell
      top={<Wordmark className="text-xl" />}
      eyebrow={t.home.greetingName(t.home.greeting[dayPart(new Date())], firstName)}
      title={club.name}
      titleSize="xl"
      tabBar={<MainTabBar current="home" />}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          {live && liveState && <LiveCard session={live} state={liveState} t={t} locale={locale} />}
          <div className="flex gap-2.5">
            <Button href="/sessions/new" variant="secondary" size="md" className="flex-1">
              <PlusIcon className="size-4" />
              {t.home.newSession}
            </Button>
            {lastRepeatable && (
              // D18: same settings as last time, on the next date; then one tap on Start.
              <Button
                href={`/sessions/new?ulitin=${lastRepeatable.id}`}
                variant="secondary"
                size="md"
                className="flex-1"
                aria-label={t.home.repeatLastOf(lastRepeatable.name)}
              >
                <RepeatIcon className="size-4" />
                {t.home.repeatLast}
              </Button>
            )}
          </div>
        </div>

        <Section id="upcoming" label={t.home.upcoming}>
          {drafts.length > 0 ? (
            <ListGroup>
              {drafts.map((session) => (
                <UpcomingRow key={session.id} session={session} t={t} locale={locale} />
              ))}
            </ListGroup>
          ) : (
            <EmptyState>{t.home.noUpcoming}</EmptyState>
          )}
        </Section>

        <Section id="past" label={t.home.past}>
          {ended.length > 0 ? (
            <ListGroup>
              {ended.map((session) => {
                const stats = endedStats.get(session.id);
                return (
                  <ListRow
                    key={session.id}
                    href={`/s/${session.id}`}
                    chevron={false}
                    trailing={
                      <span className="shrink-0 font-medium">
                        {session.fee > 0 ? formatPeso(stats?.collected ?? 0) : t.common.free}
                      </span>
                    }
                  >
                    <span className="font-medium [overflow-wrap:anywhere]">{session.name}</span>
                    <span className="text-sm text-muted">
                      {t.home.pastLine(formatShortDate(new Date(session.starts_at), locale), t.common.players(stats?.players ?? 0))}
                    </span>
                  </ListRow>
                );
              })}
            </ListGroup>
          ) : (
            <EmptyState>{t.home.noPast}</EmptyState>
          )}
        </Section>
      </div>
    </PageShell>
  );
}

function LiveCard({
  session,
  state,
  t,
  locale,
}: {
  session: Session;
  state: Awaited<ReturnType<typeof getLiveState>>;
  t: Dictionary;
  locale: Locale;
}) {
  const started = session.started_at ? new Date(session.started_at) : new Date(session.starts_at);
  return (
    <Link
      href={`/s/${session.id}`}
      aria-label={t.home.openSession(session.name)}
      className="block rounded-[22px] bg-primary p-[18px] text-on-primary focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-on-accent">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-[#1e2a06]" />
          {t.home.live}
        </span>
        <span className="text-sm text-on-dark-muted">{t.home.startedAt(formatTime(started, locale))}</span>
      </div>
      <p className="mt-3.5 font-display text-xl font-semibold [overflow-wrap:anywhere]">{session.name}</p>
      <div className="mt-3.5 flex items-end gap-5">
        <Stat value={String(session.courts_count)} label={t.home.courtsLabel} />
        <Stat value={String(state.queue.length)} label={t.home.queueLabel} />
        {session.fee > 0 && <Stat value={`${state.payments.paid}/${state.payments.total}`} label={t.home.paidLabel} />}
        <span aria-hidden="true" className="ml-auto flex size-9 items-center justify-center self-center rounded-full bg-accent text-on-accent">
          <ArrowRightIcon className="size-[18px]" />
        </span>
      </div>
    </Link>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <span className="flex flex-col">
      <span className="text-xl font-semibold">{value}</span>
      <span className="text-xs text-on-dark-muted">{label}</span>
    </span>
  );
}

function UpcomingRow({ session, t, locale }: { session: Session; t: Dictionary; locale: Locale }) {
  const startsAt = new Date(session.starts_at);
  const badge = dateBadge(startsAt, locale);
  return (
    <li>
      <Link
        href={`/s/${session.id}`}
        className="flex min-h-14 items-center gap-3.5 px-4 py-3 hover:bg-info focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-focus"
      >
        <span aria-hidden="true" className="flex w-11 shrink-0 flex-col items-center leading-tight">
          <span className="text-xs font-semibold text-muted">{badge.month}</span>
          <span className="text-xl font-semibold">{badge.day}</span>
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium [overflow-wrap:anywhere]">{session.name}</span>
          <span className="text-sm text-muted">
            <span className="sr-only">{formatShortDate(startsAt, locale)}, </span>
            {formatTimeRange(startsAt, new Date(session.ends_at), locale)} · {t.common.courts(session.courts_count)}
          </span>
        </span>
        <ChevronRightIcon className="size-4 shrink-0 text-[#9aa09c]" />
      </Link>
    </li>
  );
}
