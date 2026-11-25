import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageShell } from "@/components/ui";
import { getCurrentMembership, requireUser } from "@/lib/auth/dal";
import { en } from "@/lib/i18n/dictionary";
import { getT } from "@/lib/i18n/server";
import { CreateClubForm } from "./CreateClubForm";

export const metadata: Metadata = {
  title: `${en.club.newPageTitle} · ${en.common.appName}`,
};

export default function NewClubPage() {
  return (
    <Suspense fallback={<PageShell>{null}</PageShell>}>
      <NewClubGate />
    </Suspense>
  );
}

/** Signed-in users who already have a club go straight Home. */
async function NewClubGate() {
  const user = await requireUser("/club/new");
  if (await getCurrentMembership(user.id)) redirect("/");
  const t = await getT();
  return (
    <PageShell title={t.club.newTitle} titleSize="xl" subtitle={t.club.newSubtitle}>
      <CreateClubForm />
    </PageShell>
  );
}
