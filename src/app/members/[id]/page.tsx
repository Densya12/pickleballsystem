import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink, Card, PageShell } from "@/components/ui";
import { requireClub } from "@/lib/auth/dal";
import { getMember } from "@/lib/members/data";
import { MemberForm } from "../MemberForm";

export const metadata: Metadata = {
  title: "Member · Open Play Queue",
};

function Header() {
  return (
    <div className="flex flex-col gap-1">
      <BackLink href="/members" />
      <h1 className="text-3xl">I-edit ang member</h1>
    </div>
  );
}

export default function EditMemberPage({ params }: PageProps<"/members/[id]">) {
  return (
    <Suspense
      fallback={
        <PageShell header={<Header />}>
          <p className="text-muted">Sandali lang…</p>
        </PageShell>
      }
    >
      <EditMemberContent params={params} />
    </Suspense>
  );
}

async function EditMemberContent({ params }: Pick<PageProps<"/members/[id]">, "params">) {
  const { id } = await params;
  await requireClub(`/members/${encodeURIComponent(id)}`);
  // RLS: other clubs' members aren't readable, so they get the same 404.
  const member = await getMember(id);
  if (!member) notFound();

  return (
    <PageShell header={<Header />}>
      <Card>
        <MemberForm key={member.id} member={member} />
      </Card>
    </PageShell>
  );
}
