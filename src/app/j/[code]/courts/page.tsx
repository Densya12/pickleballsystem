import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageShell } from "@/components/ui";
import { getPlayerSessionView } from "@/lib/player/data";
import { normalizeJoinCode } from "@/lib/queue/qr";
import { CourtsView } from "./CourtsView";

export const metadata: Metadata = {
  title: "Mga court · Open Play Queue",
};

/** Mga court (D14, BR21): who is playing and who is next, for players of this session. */
export default function CourtsPage({ params }: PageProps<"/j/[code]/courts">) {
  return (
    <Suspense
      fallback={
        <PageShell>
          <p className="pt-10 text-muted">Sandali lang…</p>
        </PageShell>
      }
    >
      <CourtsContent params={params} />
    </Suspense>
  );
}

async function CourtsContent({ params }: Pick<PageProps<"/j/[code]/courts">, "params">) {
  const code = normalizeJoinCode((await params).code);
  if (!code) redirect("/j/invalid");

  // Same reads as Pwesto (RLS: players of this session); Pwesto handles every other case.
  const view = await getPlayerSessionView(code);
  if (!view || !view.me || view.session.status === "ended") redirect(`/j/${code}/me`);

  return <CourtsView code={code} view={view} />;
}
