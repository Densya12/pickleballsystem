import type { Metadata } from "next";
import { Suspense } from "react";
import { LanguageSwitch } from "@/components/i18n/LanguageSwitch";
import { MainTabBar } from "@/components/nav/MainTabBar";
import { FeedbackRow, ListGroup, ListRow, PageShell, Section } from "@/components/ui";
import { requireClub } from "@/lib/auth/dal";
import { formatPeso } from "@/lib/format";
import { en } from "@/lib/i18n/dictionary";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "./actions";
import { ReadAloudSetting } from "./ReadAloudSetting";
import { SettingsSkeleton } from "@/components/skeletons/OrganizerSkeletons";

export const metadata: Metadata = {
  title: `${en.settings.pageTitle} · ${en.common.appName}`,
};

/** Settings (D19): club pages, language, read calls aloud, the guide, sign out. */
export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <SettingsContent />
    </Suspense>
  );
}

async function SettingsContent() {
  const [{ club, role }, t] = await Promise.all([requireClub("/settings"), getT()]);
  const supabase = await createClient();
  const { data: staff } = await supabase.rpc("list_club_staff", { p_club_id: club.id });
  const value = (text: string) => <span className="max-w-[45%] truncate text-sm text-muted">{text}</span>;

  return (
    <PageShell title={t.settings.title} titleSize="xl" tabBar={<MainTabBar current="settings" />}>
      <div className="flex flex-col gap-6">
        <Section id="club" label={t.settings.club}>
          <ListGroup>
            <ListRow href="/settings/club" trailing={value(club.name)}>
              {t.settings.clubDetails}
            </ListRow>
            <ListRow href="/settings/payments" trailing={value(formatPeso(club.default_fee))}>
              {t.settings.gcashAndFee}
            </ListRow>
            {role === "owner" && <ListRow href="/settings/qr">{t.settings.clubQr}</ListRow>}
            <ListRow href="/settings/organizers" trailing={value(String(staff?.length ?? 1))}>
              {t.settings.coOrganizers}
            </ListRow>
          </ListGroup>
        </Section>

        <Section id="app" label={t.settings.app}>
          <ListGroup>
            <li className="flex flex-col gap-2.5 px-4 py-3">
              <span id="language-label">{t.settings.language}</span>
              <LanguageSwitch look="full" label={t.settings.language} />
            </li>
            <ReadAloudSetting />
          </ListGroup>
        </Section>

        <ListGroup>
          <ListRow href="/guide">{t.settings.guide}</ListRow>
          <FeedbackRow label={t.common.feedback} />
          <li>
            <form action={signOutAction}>
              <button
                type="submit"
                className="flex min-h-12 w-full items-center px-4 py-3 text-left text-danger hover:bg-info focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-focus"
              >
                {t.settings.signOut}
              </button>
            </form>
          </li>
        </ListGroup>
      </div>
    </PageShell>
  );
}
