import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Notice, PageShell } from "@/components/ui";
import { getClubEntry } from "@/lib/club/entry";
import { normalizeJoinCode } from "@/lib/queue/qr";

export const metadata: Metadata = {
  title: "Pumila · Open Play Queue",
};

/**
 * The club's permanent QR (D18). Public. Opens whichever session is live;
 * otherwise says there is none (or that the code is unknown).
 */
export default function ClubEntryPage({ params }: PageProps<"/c/[code]">) {
  return (
    <Suspense
      fallback={
        <PageShell>
          <p className="pt-10 text-muted">Sandali lang…</p>
        </PageShell>
      }
    >
      <ClubEntryContent params={params} />
    </Suspense>
  );
}

async function ClubEntryContent({ params }: Pick<PageProps<"/c/[code]">, "params">) {
  const code = normalizeJoinCode((await params).code);
  const entry = code ? await getClubEntry(code) : ({ status: "not_found" } as const);
  if (entry.status === "live") redirect(`/j/${entry.joinCode}`);

  return (
    <PageShell
      header={
        <div className="flex flex-col gap-1 pt-10">
          <p className="text-muted">Pumila sa open play</p>
          <h1 className="text-3xl break-words">{entry.status === "none" ? entry.clubName : "Open play"}</h1>
        </div>
      }
    >
      <div className="pt-4">
        {entry.status === "none" ? (
          <Notice kind="info">Wala pang open play ngayon. Balikan ang QR na ito kapag nagsimula na ang session.</Notice>
        ) : (
          <Notice kind="error">Hindi makita ang QR na ito. Tanungin ang organizer kung may bagong QR.</Notice>
        )}
      </div>
    </PageShell>
  );
}
