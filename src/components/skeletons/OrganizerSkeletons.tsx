"use client";

import { Wordmark } from "@/components/brand/Wordmark";
import { LanguageSwitch } from "@/components/i18n/LanguageSwitch";
import { MainTabBar } from "@/components/nav/MainTabBar";
import {
  BackLink,
  Button,
  ListGroup,
  ListRow,
  PageShell,
  Section,
  Skeleton,
  SkeletonCard,
  SkeletonCircle,
  SkeletonField,
  SkeletonLine,
  SkeletonRegion,
} from "@/components/ui";
import { ChevronRightIcon, PlusIcon, RepeatIcon } from "@/components/ui/icons";
import { useT } from "@/lib/i18n/client";

/*
 * First-load skeletons for the organizer screens outside a session. The page
 * shell (titles that don't depend on data, back links, tab bars, links that go
 * somewhere fixed) is real; only data becomes skeleton blocks.
 */

/** Home: the dark live card, New session / Repeat last, 1 upcoming and 2 past rows. */
export function HomeSkeleton() {
  const t = useT();
  return (
    <PageShell
      top={<Wordmark className="text-xl" />}
      eyebrow={<SkeletonLine size="inherit" width={150} />}
      titleSkeleton="62%"
      titleSize="xl"
      tabBar={<MainTabBar current="home" />}
    >
      <SkeletonRegion className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="skeleton-dark rounded-[22px] bg-primary p-[18px]">
            <div className="flex items-center justify-between gap-2">
              <Skeleton width={58} height={24} rounded="full" />
              <SkeletonLine size="sm" width={96} />
            </div>
            <SkeletonLine size="xl" width="58%" className="mt-3.5 font-display" />
            <div className="mt-3.5 flex items-end gap-5">
              {[38, 52, 34].map((w) => (
                <span key={w} className="flex flex-col">
                  <SkeletonLine size="xl" width={28} />
                  <SkeletonLine size="xs" width={w} />
                </span>
              ))}
              <SkeletonCircle size={36} className="ml-auto self-center" />
            </div>
          </div>
          <div className="flex gap-2.5">
            <Button href="/sessions/new" variant="secondary" size="md" className="flex-1">
              <PlusIcon className="size-4" />
              {t.home.newSession}
            </Button>
            <Button variant="secondary" size="md" className="flex-1" disabled>
              <RepeatIcon className="size-4" />
              {t.home.repeatLast}
            </Button>
          </div>
        </div>

        <Section id="upcoming-loading" label={t.home.upcoming}>
          <ListGroup className="skeleton-card">
            <li className="flex min-h-14 items-center gap-3.5 px-4 py-3">
              <span className="flex w-11 shrink-0 flex-col items-center">
                <SkeletonLine size="xs" width={26} />
                <SkeletonLine size="xl" width={22} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <SkeletonLine width="56%" />
                <SkeletonLine size="sm" width="72%" />
              </span>
              <ChevronRightIcon className="size-4 shrink-0 text-[#9aa09c]" />
            </li>
          </ListGroup>
        </Section>

        <Section id="past-loading" label={t.home.past}>
          <ListGroup className="skeleton-card">
            {[0, 1].map((i) => (
              <li key={i} className="flex min-h-12 items-center gap-3 px-4 py-3">
                <span className="flex min-w-0 flex-1 flex-col">
                  <SkeletonLine width={`${i ? 46 : 58}%`} />
                  <SkeletonLine size="sm" width="40%" />
                </span>
                <SkeletonLine width={52} />
              </li>
            ))}
          </ListGroup>
        </Section>
      </SkeletonRegion>
    </PageShell>
  );
}

/** Members: search field and member rows. */
export function MembersSkeleton() {
  const t = useT();
  return (
    <PageShell
      title={t.members.title}
      titleSize="xl"
      top={
        <>
          <span />
          <Button href="/members/new" size="pill" className="h-10 px-4 font-medium" aria-label={t.members.addMember}>
            <PlusIcon className="size-4" />
            {t.members.add}
          </Button>
        </>
      }
      tabBar={<MainTabBar current="members" />}
    >
      <SkeletonRegion className="flex flex-col gap-3">
        <SkeletonField labelWidth={52} />
        <ListGroup className="skeleton-card">
          {[60, 48, 66, 52, 58, 44].map((w, i) => (
            <li key={i} className="flex min-h-12 items-center gap-3 px-4 py-3">
              <span className="flex min-w-0 flex-1 flex-col">
                <SkeletonLine width={`${w}%`} />
                <SkeletonLine size="sm" width="44%" />
              </span>
              <ChevronRightIcon className="size-4 shrink-0 text-[#9aa09c]" />
            </li>
          ))}
        </ListGroup>
      </SkeletonRegion>
    </PageShell>
  );
}

/** Member (new or edit): name, level chips, dues, notes, Save. */
export function MemberFormSkeleton({ edit }: { edit: boolean }) {
  const t = useT();
  return (
    <PageShell top={<BackLink href="/members" label={t.members.title} />} title={edit ? t.members.editTitle : t.members.newTitle}>
      <SkeletonRegion className="flex flex-col gap-3">
        <SkeletonCard className="flex flex-col gap-4">
          <SkeletonField labelWidth={48} />
          <div className="flex flex-col gap-1.5">
            <SkeletonLine size="sm" width={40} />
            <div className="flex flex-wrap gap-1.5">
              {[78, 104, 88, 80].map((w) => (
                <Skeleton key={w} width={w} height={34} rounded="full" />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <SkeletonLine size="sm" width={40} />
            <Skeleton height={42} className="w-full" />
          </div>
          <SkeletonField labelWidth={110} />
        </SkeletonCard>
        <Skeleton height={52} rounded="button" className="mt-2 w-full" />
      </SkeletonRegion>
    </PageShell>
  );
}

/** Settings: the rows are real links; only their values are loading. */
export function SettingsSkeleton() {
  const t = useT();
  const value = (width: number) => (
    <span className="max-w-[45%]">
      <SkeletonLine size="sm" width={width} />
    </span>
  );
  return (
    <PageShell title={t.settings.title} titleSize="xl" tabBar={<MainTabBar current="settings" />}>
      <SkeletonRegion className="flex flex-col gap-6">
        <Section id="club-loading" label={t.settings.club}>
          <ListGroup className="skeleton-card">
            <ListRow href="/settings/club" trailing={value(110)}>
              {t.settings.clubDetails}
            </ListRow>
            <ListRow href="/settings/qr">{t.settings.clubQr}</ListRow>
            <ListRow href="/settings/organizers" trailing={value(14)}>
              {t.settings.coOrganizers}
            </ListRow>
          </ListGroup>
        </Section>
        <Section id="app-loading" label={t.settings.app}>
          <ListGroup className="skeleton-card">
            <li className="flex flex-col gap-2.5 px-4 py-3">
              <span>{t.settings.language}</span>
              <LanguageSwitch look="full" label={t.settings.language} />
            </li>
            <li className="flex min-h-[72px] items-center gap-3 px-4 py-3">
              <span className="flex min-w-0 flex-1 flex-col">
                <SkeletonLine width="44%" />
                <SkeletonLine size="sm" width="70%" />
              </span>
              <Skeleton width={50} height={30} rounded="full" />
            </li>
          </ListGroup>
        </Section>
        <ListGroup>
          <ListRow href="/guide">{t.settings.guide}</ListRow>
        </ListGroup>
      </SkeletonRegion>
    </PageShell>
  );
}

/** A Settings sub-page (club details, club QR, co-organizers): fields and Save. */
export function SettingsFormSkeleton({
  page,
  fields = 3,
}: {
  page: "clubDetails" | "clubQr" | "coOrganizers";
  fields?: number;
}) {
  const t = useT();
  return (
    <PageShell top={<BackLink href="/settings" label={t.settings.title} />} title={t.settings[page]}>
      <SkeletonRegion className="flex flex-col gap-3">
        <SkeletonCard className="flex flex-col gap-4">
          {Array.from({ length: fields }, (_, i) => (
            <SkeletonField key={i} labelWidth={[90, 120, 70][i % 3]} />
          ))}
        </SkeletonCard>
        <Skeleton height={52} rounded="button" className="mt-2 w-full" />
      </SkeletonRegion>
    </PageShell>
  );
}

/** New session: the form's three cards and its two buttons. */
export function NewSessionSkeleton() {
  const t = useT();
  const segmented = (key: string | number) => <Skeleton key={key} height={42} className="w-full" />;
  return (
    <PageShell top={<BackLink href="/" label={t.nav.home} />} title={t.session.newTitle}>
      <SkeletonRegion className="flex flex-col gap-3">
        <SkeletonCard className="flex flex-col gap-4">
          <SkeletonField labelWidth={100} />
          <div className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2">
            <SkeletonField labelWidth={44} />
            <SkeletonField labelWidth={40} />
          </div>
        </SkeletonCard>
        <SkeletonCard className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <SkeletonLine size="sm" width={50} />
            <div className="flex items-center justify-between">
              <SkeletonCircle size={44} />
              <SkeletonLine size="xl" width={90} />
              <SkeletonCircle size={44} />
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            <SkeletonLine size="sm" width={120} />
            {[0, 1].map((i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <SkeletonLine size="sm" width={54} />
                {segmented(i)}
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <SkeletonLine size="sm" width={64} />
            {segmented("points")}
          </div>
          <div className="flex flex-col gap-1.5">
            <SkeletonLine size="sm" width={100} />
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center gap-3 py-2.5">
                <SkeletonCircle size={20} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <SkeletonLine width="36%" />
                  <SkeletonLine size="sm" width="62%" />
                </span>
              </div>
            ))}
          </div>
        </SkeletonCard>
        <SkeletonCard className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="flex min-w-0 flex-1 flex-col">
              <SkeletonLine width="48%" />
              <SkeletonLine size="sm" width="56%" />
            </span>
            <Skeleton width={50} height={30} rounded="full" />
          </div>
          <SkeletonField labelWidth={120} />
          <Skeleton height={76} className="w-full" />
        </SkeletonCard>
        <div className="mt-2 flex flex-col gap-1">
          <Skeleton height={52} rounded="button" className="w-full" />
          <Skeleton height={44} rounded="button" className="mx-auto w-1/3" />
        </div>
      </SkeletonRegion>
    </PageShell>
  );
}

/** Organizer guide: the section cards. */
export function GuideSkeleton() {
  const t = useT();
  return (
    <PageShell top={<BackLink href="/settings" label={t.settings.title} />} title={t.guide.title} subtitle={t.guide.subtitle}>
      <SkeletonRegion className="flex flex-col gap-5">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonCard key={i} className="flex flex-col gap-2">
            <SkeletonLine size="lg" width="46%" className="font-display" />
            {[92, 80, 86].map((w) => (
              <SkeletonLine key={w} width={`${w}%`} />
            ))}
          </SkeletonCard>
        ))}
      </SkeletonRegion>
    </PageShell>
  );
}
