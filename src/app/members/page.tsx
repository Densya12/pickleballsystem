import type { Metadata } from "next";
import { Suspense } from "react";
import { MainTabBar } from "@/components/nav/MainTabBar";
import { Button, EmptyState, Notice, PageShell } from "@/components/ui";
import { PlusIcon } from "@/components/ui/icons";
import { requireClub } from "@/lib/auth/dal";
import { en } from "@/lib/i18n/dictionary";
import { getT } from "@/lib/i18n/server";
import { getMembers } from "@/lib/members/data";
import { MembersList } from "./MembersList";
import { MembersSkeleton } from "@/components/skeletons/OrganizerSkeletons";

export const metadata: Metadata = {
  title: `${en.members.pageTitle} · ${en.common.appName}`,
};

export default function MembersPage({ searchParams }: PageProps<"/members">) {
  return (
    <Suspense fallback={<MembersSkeleton />}>
      <MembersContent searchParams={searchParams} />
    </Suspense>
  );
}

async function MembersContent({ searchParams }: Pick<PageProps<"/members">, "searchParams">) {
  const { club } = await requireClub("/members");
  const [members, { saved }, t] = await Promise.all([getMembers(club.id), searchParams, getT()]);

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
      <div className="flex flex-col gap-4">
        {typeof saved === "string" && <Notice kind="success">{t.members.savedBanner(saved)}</Notice>}
        {members.length > 0 ? <MembersList members={members} /> : <EmptyState>{t.members.empty}</EmptyState>}
      </div>
    </PageShell>
  );
}
