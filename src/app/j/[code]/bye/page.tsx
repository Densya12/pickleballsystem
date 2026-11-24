import type { Metadata } from "next";
import { Suspense } from "react";
import { Button, PageShell } from "@/components/ui";

export const metadata: Metadata = {
  title: "Salamat · Open Play Queue",
};

/** After "Aalis na ako" (BR18). Checking in again puts the player at the end of the queue. */
export default function ByePage({ params }: PageProps<"/j/[code]/bye">) {
  return (
    <PageShell
      header={
        <div className="flex flex-col gap-2 pt-10">
          <h1 className="text-3xl">Salamat sa paglalaro!</h1>
          <p className="text-muted">Wala ka na sa pila. Kung gusto mong maglaro ulit, pumila ka sa dulo.</p>
        </div>
      }
    >
      <div className="pt-4">
        <Suspense fallback={null}>
          <CheckInAgain params={params} />
        </Suspense>
      </div>
    </PageShell>
  );
}

async function CheckInAgain({ params }: Pick<PageProps<"/j/[code]/bye">, "params">) {
  const { code } = await params;
  return (
    <Button href={`/j/${encodeURIComponent(code)}`} size="lg" fullWidth>
      Pumila ulit
    </Button>
  );
}
