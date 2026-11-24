import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink, PageShell } from "@/components/ui";
import { requireClub } from "@/lib/auth/dal";
import { getSession } from "@/lib/session/data";
import { repeatDefaults } from "@/lib/session/repeat";
import { defaultSessionTimes } from "@/lib/session/time";
import { COURTS_DEFAULT } from "@/lib/session/validation";
import { NewSessionForm } from "./NewSessionForm";

export const metadata: Metadata = {
  title: "Bagong open play · Open Play Queue",
};

function Header({ repeating }: { repeating?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <BackLink href="/" />
      <h1 className="text-3xl">Bagong open play</h1>
      {repeating && (
        <p className="text-muted [overflow-wrap:anywhere]">
          Kinopya mula sa {repeating}. I-check ang petsa, saka pindutin ang Simulan.
        </p>
      )}
    </div>
  );
}

export default function NewSessionPage({ searchParams }: PageProps<"/sessions/new">) {
  return (
    <Suspense
      fallback={
        <PageShell header={<Header />}>
          <p className="text-muted">Sandali lang…</p>
        </PageShell>
      }
    >
      <NewSessionContent searchParams={searchParams} />
    </Suspense>
  );
}

async function NewSessionContent({ searchParams }: Pick<PageProps<"/sessions/new">, "searchParams">) {
  const { club } = await requireClub("/sessions/new");
  const { ulitin } = await searchParams;
  const now = new Date();

  // "Ulitin" (D18): only a session of the current club (RLS also limits reads to the user's clubs).
  const last = typeof ulitin === "string" ? await getSession(ulitin) : null;
  const repeat = last && last.club_id === club.id ? last : null;
  const times = defaultSessionTimes(now);

  return (
    <NewSessionForm
      key={repeat?.id ?? "new"}
      header={<Header repeating={repeat?.name} />}
      defaults={
        repeat
          ? repeatDefaults(repeat, now)
          : {
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
            }
      }
      gcash={{ name: club.gcash_name, number: club.gcash_number }}
    />
  );
}
