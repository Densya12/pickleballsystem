import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { BackLink, PageShell } from "@/components/ui";
import { requireUser } from "@/lib/auth/dal";
import { getSessionPayments } from "@/lib/payments/data";
import { getSession } from "@/lib/session/data";
import { PaymentsView } from "./PaymentsView";

export const metadata: Metadata = {
  title: "Bayad · Open Play Queue",
};

/** Bayad: who has paid, who to check in GCash, who still owes (D16). */
export default function PaymentsPage({ params }: PageProps<"/s/[id]/payments">) {
  return (
    <Suspense
      fallback={
        <PageShell>
          <p className="text-muted">Sandali lang…</p>
        </PageShell>
      }
    >
      <PaymentsContent params={params} />
    </Suspense>
  );
}

async function PaymentsContent({ params }: Pick<PageProps<"/s/[id]/payments">, "params">) {
  const { id } = await params;
  await requireUser(`/s/${encodeURIComponent(id)}/payments`);
  const session = await getSession(id);
  if (!session) notFound();
  // Drafts have no players yet; live and ended sessions can be settled here.
  if (session.status === "draft") redirect(`/s/${session.id}/live`);

  const players = await getSessionPayments(session.id);
  return (
    <PaymentsView
      header={<BackLink href={`/s/${session.id}/live`} />}
      session={{
        id: session.id,
        name: session.name,
        fee: session.fee,
        payFirst: session.pay_first,
        gcashName: session.gcash_name,
        gcashNumber: session.gcash_number,
      }}
      players={players}
    />
  );
}
