import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { BackLink, Card, PageShell } from "@/components/ui";
import { requireUser } from "@/lib/auth/dal";
import { getSession } from "@/lib/session/data";
import { WalkInForm } from "./WalkInForm";

export const metadata: Metadata = {
  title: "Magdagdag ng walk-in · Open Play Queue",
};

export default function WalkInPage({ params }: PageProps<"/s/[id]/walk-in">) {
  return (
    <Suspense
      fallback={
        <PageShell>
          <p className="text-muted">Sandali lang…</p>
        </PageShell>
      }
    >
      <WalkInContent params={params} />
    </Suspense>
  );
}

async function WalkInContent({ params }: Pick<PageProps<"/s/[id]/walk-in">, "params">) {
  const { id } = await params;
  await requireUser(`/s/${encodeURIComponent(id)}/walk-in`);
  const session = await getSession(id);
  if (!session) notFound();
  // Walk-ins only join a live queue.
  if (session.status !== "live") redirect(`/s/${session.id}/live`);

  return (
    <PageShell
      header={
        <div className="flex flex-col gap-1">
          <BackLink href={`/s/${session.id}/live`} />
          <h1 className="text-3xl">Magdagdag ng walk-in</h1>
          <p className="text-muted">Para sa player na walang phone o hindi makapag-scan.</p>
        </div>
      }
    >
      <Card className="mt-2">
        <WalkInForm sessionId={session.id} fee={session.fee} />
      </Card>
    </PageShell>
  );
}
