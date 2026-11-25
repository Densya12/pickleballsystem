import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { PageShell } from "@/components/ui";
import { requireUser } from "@/lib/auth/dal";
import { en } from "@/lib/i18n/dictionary";
import { getT } from "@/lib/i18n/server";
import { getLiveState } from "@/lib/queue/data";
import { getSession } from "@/lib/session/data";
import { LiveHeaderActions } from "../_components/LiveHeader";
import { QueueView } from "../_components/QueueView";
import { SessionDetails } from "../_components/SessionDetails";
import { SessionFrame } from "../_components/SessionFrame";

export const metadata: Metadata = {
  title: `${en.live.queueTitle} · ${en.common.appName}`,
};

/** Queue tab (D19). */
export default function QueuePage({ params, searchParams }: PageProps<"/s/[id]/queue">) {
  return (
    <Suspense fallback={<PageShell>{null}</PageShell>}>
      <QueueContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function QueueContent({ params, searchParams }: Pick<PageProps<"/s/[id]/queue">, "params" | "searchParams">) {
  const { id } = await params;
  await requireUser(`/s/${encodeURIComponent(id)}/queue`);
  const session = await getSession(id);
  if (!session) notFound();
  if (session.status !== "live") redirect(`/s/${session.id}`);

  const [state, t, { added }] = await Promise.all([getLiveState(session.id), getT(), searchParams]);
  // Banner after adding a walk-in (that page redirects here with ?added=<player id>).
  const addedPlayer = typeof added === "string" ? state.queue.find((p) => p.id === added) : undefined;

  return (
    <SessionFrame
      session={{ id: session.id, fee: session.fee, rotation: session.rotation }}
      tab="queue"
      title={t.live.queueTitle}
      subtitle={t.live.queueSubtitle(state.queue.length)}
      actions={<LiveHeaderActions sessionId={session.id} t={t} />}
      courts={state.courts}
      queueCount={state.queue.length}
      paymentsBadge={state.payments.toCheck + state.payments.unpaid}
      details={<SessionDetails session={session} t={t} />}
      incomingBanner={addedPlayer ? { key: addedPlayer.id, text: t.live.walkInAdded(addedPlayer.name, addedPlayer.position) } : null}
    >
      <QueueView state={state} rules={{ payFirst: session.pay_first, fee: session.fee }} sessionId={session.id} />
    </SessionFrame>
  );
}
