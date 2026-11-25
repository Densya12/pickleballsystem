import { redirect } from "next/navigation";
import { Suspense } from "react";

/** Old address (before D19). Courts is now /s/[id]; a walk-in banner (?added=) shows on Queue. */
export default function OldLivePage({ params, searchParams }: PageProps<"/s/[id]/live">) {
  return (
    <Suspense fallback={null}>
      <Redirect params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Redirect({ params, searchParams }: Pick<PageProps<"/s/[id]/live">, "params" | "searchParams">): Promise<null> {
  const [{ id }, { added }] = await Promise.all([params, searchParams]);
  const target = `/s/${encodeURIComponent(id)}`;
  redirect(typeof added === "string" ? `${target}/queue?added=${encodeURIComponent(added)}` : target);
}
