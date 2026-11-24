import type { Metadata } from "next";
import { Suspense } from "react";
import { Notice, PageShell } from "@/components/ui";
import { normalizeJoinCode } from "@/lib/queue/qr";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Pumila · Open Play Queue",
};

/** Player link from the QR. Public placeholder until check-in arrives in Phase 4. */
export default function JoinPage({ params }: PageProps<"/j/[code]">) {
  return (
    <PageShell
      header={
        <div className="pt-10">
          <h1 className="text-3xl">Pumila sa open play</h1>
        </div>
      }
    >
      <div className="pt-4">
        <Suspense fallback={<p className="text-muted">Sandali lang…</p>}>
          <JoinStatus params={params} />
        </Suspense>
      </div>
    </PageShell>
  );
}

async function JoinStatus({ params }: Pick<PageProps<"/j/[code]">, "params">) {
  const code = normalizeJoinCode((await params).code);
  const supabase = await createClient();
  const open = code ? (await supabase.rpc("is_checkin_open", { p_join_code: code })).data === true : false;

  return open ? (
    <Notice kind="info">Malapit na ang check-in. Sa ngayon, sabihin sa organizer ang pangalan mo.</Notice>
  ) : (
    <Notice kind="error">Sarado na ang check-in. Tanungin ang organizer kung may bagong QR.</Notice>
  );
}
