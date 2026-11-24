import { Suspense } from "react";
import { Button, Card, PageShell } from "@/components/ui";
import { requireClub } from "@/lib/auth/dal";

/** Home placeholder. Sessions arrive in Phase 2. */
export default function Home() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const { club } = await requireClub();

  return (
    <PageShell
      header={
        <div className="flex flex-col gap-1 pt-6">
          <h1 className="text-3xl break-words">{club.name}</h1>
          {club.city && <p className="text-muted">{club.city}</p>}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-2">
          <h2 className="text-xl">Mga session</h2>
          <p className="text-muted">Wala pang session. Darating ito sa susunod na update.</p>
        </Card>
        <Button href="/settings" variant="secondary" fullWidth>
          Settings ng club
        </Button>
      </div>
    </PageShell>
  );
}

function HomeSkeleton() {
  return (
    <PageShell>
      <p className="pt-10 text-muted">Sandali lang…</p>
    </PageShell>
  );
}
