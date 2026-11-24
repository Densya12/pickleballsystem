import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink, Card, PageShell } from "@/components/ui";
import { requireClub } from "@/lib/auth/dal";
import { MemberForm } from "../MemberForm";

export const metadata: Metadata = {
  title: "Bagong member · Open Play Queue",
};

function Header() {
  return (
    <div className="flex flex-col gap-1">
      <BackLink href="/members" />
      <h1 className="text-3xl">Bagong member</h1>
    </div>
  );
}

export default function NewMemberPage() {
  return (
    <Suspense
      fallback={
        <PageShell header={<Header />}>
          <p className="text-muted">Sandali lang…</p>
        </PageShell>
      }
    >
      <NewMemberContent />
    </Suspense>
  );
}

async function NewMemberContent() {
  await requireClub("/members/new");
  return (
    <PageShell header={<Header />}>
      <Card>
        <MemberForm member={null} />
      </Card>
    </PageShell>
  );
}
