import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink, PageShell } from "@/components/ui";
import { requireClub } from "@/lib/auth/dal";
import { defaultSessionTimes } from "@/lib/session/time";
import { COURTS_DEFAULT } from "@/lib/session/validation";
import { NewSessionForm } from "./NewSessionForm";

export const metadata: Metadata = {
  title: "Bagong open play · Open Play Queue",
};

function Header() {
  return (
    <div className="flex flex-col gap-1">
      <BackLink href="/" />
      <h1 className="text-3xl">Bagong open play</h1>
    </div>
  );
}

export default function NewSessionPage() {
  return (
    <Suspense
      fallback={
        <PageShell header={<Header />}>
          <p className="text-muted">Sandali lang…</p>
        </PageShell>
      }
    >
      <NewSessionContent />
    </Suspense>
  );
}

async function NewSessionContent() {
  const { club } = await requireClub("/sessions/new");
  const times = defaultSessionTimes(new Date());

  return (
    <NewSessionForm
      header={<Header />}
      defaults={{
        name: "",
        starts_at: times.startsAt,
        ends_at: times.endsAt,
        courts_count: String(COURTS_DEFAULT),
        // BR2: new-session defaults come from the club.
        points_to: String(club.default_points),
        rotation: club.default_rotation,
        pay_first: "",
        fee: String(club.default_fee),
        court_formats: "",
      }}
      gcash={{ name: club.gcash_name, number: club.gcash_number }}
    />
  );
}
