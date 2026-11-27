import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { IconLink } from "@/components/ui";
import { DownloadIcon } from "@/components/ui/icons";
import { requireUser } from "@/lib/auth/dal";
import { en } from "@/lib/i18n/dictionary";
import { getT } from "@/lib/i18n/server";
import { getSessionPayments } from "@/lib/payments/data";
import { getLiveState } from "@/lib/queue/data";
import { getSession } from "@/lib/session/data";
import { PaymentsView } from "../_components/PaymentsView";
import { SessionDetails } from "../_components/SessionDetails";
import { SessionFrame } from "../_components/SessionFrame";
import { PaymentsSkeleton } from "../_components/SessionSkeletons";

export const metadata: Metadata = {
  title: en.payments.pageTitle,
};

/** Payments tab (D16, D19). Also open after the session ends, to settle the rest. */
export default function PaymentsPage({ params }: PageProps<"/s/[id]/payments">) {
  return (
    <Suspense fallback={<PaymentsSkeleton />}>
      <PaymentsContent params={params} />
    </Suspense>
  );
}

async function PaymentsContent({ params }: Pick<PageProps<"/s/[id]/payments">, "params">) {
  const { id } = await params;
  await requireUser(`/s/${encodeURIComponent(id)}/payments`);
  const session = await getSession(id);
  if (!session) notFound();
  // Drafts have no players yet.
  if (session.status === "draft") redirect(`/s/${session.id}`);

  const [players, state, t] = await Promise.all([getSessionPayments(session.id), getLiveState(session.id), getT()]);
  const ended = session.status === "ended";

  return (
    <SessionFrame
      session={{ id: session.id, fee: session.fee, rotation: session.rotation, matchmaking: session.matchmaking, callMode: session.call_mode }}
      tab="payments"
      title={t.payments.title}
      actions={
        <IconLink href={`/s/${session.id}/export`} label={t.payments.downloadList} prefetch={false}>
          <DownloadIcon className="size-[18px]" />
        </IconLink>
      }
      courts={state.courts}
      queueCount={state.queue.length}
      paymentsBadge={state.payments.toCheck + state.payments.unpaid}
      details={<SessionDetails session={session} t={t} />}
      ended={ended}
    >
      <PaymentsView
        session={{
          id: session.id,
          name: session.name,
          fee: session.fee,
          payFirst: session.pay_first,
          status: session.status,
          gcashName: session.gcash_name,
          gcashNumber: session.gcash_number,
        }}
        players={players}
      />
    </SessionFrame>
  );
}
