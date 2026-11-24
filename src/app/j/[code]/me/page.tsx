import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Notice, PageShell } from "@/components/ui";
import { getCheckinPreview, getPlayerSessionView } from "@/lib/player/data";
import { normalizeJoinCode } from "@/lib/queue/qr";
import { PlayerView } from "./PlayerView";

export const metadata: Metadata = {
  title: "Pwesto sa pila · Open Play Queue",
};

export default function PwestoPage({ params }: PageProps<"/j/[code]/me">) {
  return (
    <Suspense
      fallback={
        <PageShell>
          <p className="pt-10 text-muted">Sandali lang…</p>
        </PageShell>
      }
    >
      <PwestoContent params={params} />
    </Suspense>
  );
}

async function PwestoContent({ params }: Pick<PageProps<"/j/[code]/me">, "params">) {
  const code = normalizeJoinCode((await params).code);
  if (!code) redirect("/j/invalid");

  const view = await getPlayerSessionView(code);
  if (!view) {
    // Not (or no longer) in this session's queue.
    const preview = await getCheckinPreview(code);
    if (preview.status === "ended") return <Ended />;
    redirect(`/j/${code}`);
  }
  if (view.session.status === "ended") return <Ended />;
  // Staff can read the session but have no row: send them to check-in like anyone else.
  if (!view.me) redirect(`/j/${code}`);

  return <PlayerView code={code} view={view} />;
}

function Ended() {
  return (
    <PageShell
      header={
        <div className="pt-10">
          <h1 className="text-3xl">Tapos na ang open play. Salamat!</h1>
        </div>
      }
    >
      <div className="pt-4">
        <Notice kind="info">Sarado na ang pila para sa session na ito.</Notice>
      </div>
    </PageShell>
  );
}
