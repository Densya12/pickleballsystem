import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink, Button, Notice, PageShell } from "@/components/ui";
import { PlusIcon } from "@/components/ui/icons";
import { requireClub } from "@/lib/auth/dal";
import { getMembers } from "@/lib/members/data";
import { MembersList } from "./MembersList";

export const metadata: Metadata = {
  title: "Mga member · Open Play Queue",
};

function Header() {
  return (
    <div className="flex flex-col gap-1">
      <BackLink href="/" />
      <h1 className="text-3xl">Mga member</h1>
    </div>
  );
}

export default function MembersPage({ searchParams }: PageProps<"/members">) {
  return (
    <Suspense
      fallback={
        <PageShell header={<Header />}>
          <p className="text-muted">Sandali lang…</p>
        </PageShell>
      }
    >
      <MembersContent searchParams={searchParams} />
    </Suspense>
  );
}

async function MembersContent({ searchParams }: Pick<PageProps<"/members">, "searchParams">) {
  const { club } = await requireClub("/members");
  const [members, { saved }] = await Promise.all([getMembers(club.id), searchParams]);

  return (
    <PageShell header={<Header />}>
      <div className="flex flex-col gap-5">
        {typeof saved === "string" && <Notice kind="success">Na-save si {saved}.</Notice>}
        <Button href="/members/new" size="lg" fullWidth>
          <PlusIcon />
          Magdagdag ng member
        </Button>
        {members.length > 0 ? (
          <MembersList members={members} />
        ) : (
          <p className="rounded-card border border-dashed border-strong px-5 py-4 text-muted">
            Wala pang member. Pindutin ang Magdagdag ng member, o i-save ang isang player mula sa pila o sa Buod
            ng session.
          </p>
        )}
      </div>
    </PageShell>
  );
}
