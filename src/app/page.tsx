import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Button, Card, PageShell } from "@/components/ui";
import { BallIcon, ChevronRightIcon, PlusIcon, RepeatIcon } from "@/components/ui/icons";
import { requireClub } from "@/lib/auth/dal";
import { formatCourts, formatPeso } from "@/lib/format";
import { getHomeSessions, type Session } from "@/lib/session/data";
import { dateBadge, formatDate, formatSchedule, formatTimeRange, greeting } from "@/lib/session/time";

/**
 * Home: the live session (BR1: at most one), upcoming drafts and past sessions.
 * Past sessions show players and the ₱ collected. "Mga member", Settings and
 * the guide are at the bottom.
 */
export default function Home() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const { user, club } = await requireClub();
  const { live, drafts, ended, endedStats, lastRepeatable } = await getHomeSessions(club.id);
  const firstName = user.name?.split(/\s+/)[0];

  return (
    <PageShell
      header={
        <div className="flex flex-col gap-1 pt-6">
          <p className="text-muted">
            {greeting(new Date())}
            {firstName ? `, ${firstName}` : ""}!
          </p>
          <h1 className="text-3xl break-words">{club.name}</h1>
          {club.city && <p className="text-muted">{club.city}</p>}
        </div>
      }
    >
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          {live && <LiveCard session={live} />}
          <Button href="/sessions/new" size="lg" fullWidth>
            <PlusIcon />
            Bagong open play
          </Button>
          {lastRepeatable && (
            // D18: same settings as last time, on the next date; then one tap on "Simulan".
            <Button href={`/sessions/new?ulitin=${lastRepeatable.id}`} variant="secondary" fullWidth>
              <RepeatIcon />
              <span className="min-w-0 [overflow-wrap:anywhere]">Ulitin: {lastRepeatable.name}</span>
            </Button>
          )}
        </div>

        <Section title="Mga susunod na session" id="upcoming">
          {drafts.length > 0 ? (
            <SessionList>
              {drafts.map((session) => (
                <UpcomingRow key={session.id} session={session} />
              ))}
            </SessionList>
          ) : (
            <EmptyState>Wala pang naka-schedule. Pindutin ang Bagong open play para gumawa.</EmptyState>
          )}
        </Section>

        <Section title="Nakaraang session" id="past">
          {ended.length > 0 ? (
            <SessionList>
              {ended.map((session) => (
                <PastRow key={session.id} session={session} stats={endedStats.get(session.id)} />
              ))}
            </SessionList>
          ) : (
            <EmptyState>Wala pang natapos na session.</EmptyState>
          )}
        </Section>

        <nav aria-label="Iba pa" className="flex flex-col gap-3">
          <Button href="/members" variant="secondary" fullWidth>
            Mga member
          </Button>
          <Button href="/settings" variant="secondary" fullWidth>
            Settings ng club
          </Button>
          <Button href="/guide" variant="secondary" fullWidth>
            Gabay para sa organizer
          </Button>
        </nav>
      </div>
    </PageShell>
  );
}

function LiveCard({ session }: { session: Session }) {
  const startsAt = new Date(session.starts_at);
  const endsAt = new Date(session.ends_at);
  return (
    <section
      aria-labelledby="live-heading"
      className="flex flex-col gap-3 rounded-card border-[1.5px] border-ink bg-accent-soft p-5 shadow-card"
    >
      <p
        id="live-heading"
        className="inline-flex items-center gap-1.5 self-start rounded-full bg-accent px-3 py-1 text-sm font-bold tracking-wide text-ink"
      >
        <BallIcon className="size-4 shrink-0" />
        LIVE NGAYON
      </p>
      <h2 className="text-2xl break-words">{session.name}</h2>
      <p className="text-on-accent-soft">
        {formatSchedule(startsAt, endsAt)} · {formatCourts(session.courts_count)}
      </p>
      <Button href={`/s/${session.id}/live`} size="lg" fullWidth>
        Buksan ang session
      </Button>
    </section>
  );
}

function UpcomingRow({ session }: { session: Session }) {
  const startsAt = new Date(session.starts_at);
  const badge = dateBadge(startsAt);
  return (
    <RowLink href={`/s/${session.id}/live`}>
      <span
        aria-hidden="true"
        className="flex w-14 shrink-0 flex-col items-center rounded-control bg-subtle py-1.5 leading-tight"
      >
        <span className="text-sm font-semibold text-muted">{badge.month}</span>
        <span className="font-display text-xl font-semibold">{badge.day}</span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold break-words">{session.name}</span>
        {/* The badge is hidden from screen readers; this line carries the date too. */}
        <span className="text-muted">
          <span className="sr-only">{formatDate(startsAt)}, </span>
          {formatTimeRange(startsAt, new Date(session.ends_at))} · {formatCourts(session.courts_count)}
        </span>
      </span>
    </RowLink>
  );
}

function PastRow({ session, stats }: { session: Session; stats?: { players: number; collected: number } }) {
  return (
    <RowLink href={`/s/${session.id}/live`}>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold break-words">{session.name}</span>
        <span className="text-muted">{formatDate(new Date(session.starts_at))}</span>
        {stats && (
          <span className="text-muted">
            {stats.players} {stats.players === 1 ? "player" : "players"}
            {session.fee > 0 ? ` · ${formatPeso(stats.collected)} nakolekta` : " · libre"}
          </span>
        )}
      </span>
    </RowLink>
  );
}

function RowLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-16 items-center gap-4 px-4 py-3 hover:bg-subtle focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-focus"
      >
        {children}
        <ChevronRightIcon className="size-5 shrink-0 text-muted" />
      </Link>
    </li>
  );
}

function SessionList({ children }: { children: ReactNode }) {
  return (
    <Card padding="none" className="overflow-hidden">
      <ul className="flex flex-col divide-y divide-default">{children}</ul>
    </Card>
  );
}

function Section({ title, id, children }: { title: string; id: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-3">
      <h2 id={`${id}-heading`} className="text-2xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-card border border-dashed border-strong px-5 py-4 text-muted">{children}</p>;
}

function HomeSkeleton() {
  return (
    <PageShell>
      <p className="pt-10 text-muted">Sandali lang…</p>
    </PageShell>
  );
}
