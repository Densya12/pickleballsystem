import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink, PageShell } from "@/components/ui";
import { requireClub } from "@/lib/auth/dal";
import { en } from "@/lib/i18n/dictionary";
import { getT } from "@/lib/i18n/server";
import { getSession } from "@/lib/session/data";
import { repeatDefaults } from "@/lib/session/repeat";
import { defaultSessionTimes } from "@/lib/session/time";
import { COURTS_DEFAULT } from "@/lib/session/validation";
import { createClient } from "@/lib/supabase/server";
import { NewSessionForm } from "./NewSessionForm";
import { NewSessionSkeleton } from "@/components/skeletons/OrganizerSkeletons";

export const metadata: Metadata = {
  title: en.session.newPageTitle,
};

export default function NewSessionPage({ searchParams }: PageProps<"/sessions/new">) {
  return (
    <Suspense fallback={<NewSessionSkeleton />}>
      <NewSessionContent searchParams={searchParams} />
    </Suspense>
  );
}

async function NewSessionContent({ searchParams }: Pick<PageProps<"/sessions/new">, "searchParams">) {
  const [{ club }, { ulitin }, t] = await Promise.all([requireClub("/sessions/new"), searchParams, getT()]);
  // QA-04 / BR1: say up front that another session is live (only one can be).
  const supabase = await createClient();
  const { data: liveSession } = await supabase
    .from("sessions")
    .select("id, name")
    .eq("club_id", club.id)
    .eq("status", "live")
    .maybeSingle();
  const now = new Date();

  // "Repeat last" (D18): only a session of the current club (RLS also limits reads to the user's clubs).
  const last = typeof ulitin === "string" ? await getSession(ulitin) : null;
  const repeat = last && last.club_id === club.id ? last : null;
  const times = defaultSessionTimes(now);

  return (
    <PageShell
      top={<BackLink href="/" label={t.nav.home} />}
      title={t.session.newTitle}
      subtitle={repeat ? t.session.copiedFrom(repeat.name) : undefined}
    >
      <NewSessionForm
        key={repeat?.id ?? "new"}
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
                matchmaking: club.default_matchmaking,
                call_mode: club.default_call_mode,
                pay_first: "",
                fee: String(club.default_fee),
                court_formats: "",
              }
        }
        gcash={{ name: club.gcash_name, number: club.gcash_number }}
        liveSession={liveSession}
      />
    </PageShell>
  );
}
