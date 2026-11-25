import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink, PageShell } from "@/components/ui";
import { en } from "@/lib/i18n/dictionary";
import { getT } from "@/lib/i18n/server";
import { ClubSettingsForm } from "../ClubSettingsForm";
import { getClubFormValues } from "../data";

export const metadata: Metadata = {
  title: `${en.settings.gcashAndFee} · ${en.common.appName}`,
};

export default function Page() {
  return (
    <Suspense fallback={<PageShell>{null}</PageShell>}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const [{ values, isOwner }, t] = await Promise.all([getClubFormValues(), getT()]);
  return (
    <PageShell top={<BackLink href="/settings" label={t.settings.title} />} title={t.settings.gcashAndFee}>
      <ClubSettingsForm section="payments" club={values} isOwner={isOwner} />
    </PageShell>
  );
}
