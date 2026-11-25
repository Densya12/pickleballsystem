import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink, PageShell } from "@/components/ui";
import { en } from "@/lib/i18n/dictionary";
import { getT } from "@/lib/i18n/server";
import { PrintButton } from "./PrintButton";
import { GuideSkeleton } from "@/components/skeletons/OrganizerSkeletons";

export const metadata: Metadata = {
  title: `${en.guide.pageTitle} · ${en.common.appName}`,
};

/** One printable page for the organizer, in the device's language (opened from Settings). */
export default function GuidePage() {
  return (
    <Suspense fallback={<GuideSkeleton />}>
      <Guide />
    </Suspense>
  );
}

async function Guide() {
  const t = await getT();
  return (
    <PageShell
      className="print:bg-surface"
      top={<BackLink href="/settings" label={t.settings.title} />}
      title={t.guide.title}
      subtitle={t.guide.subtitle}
      footer={<PrintButton label={t.guide.print} />}
    >
      <div className="flex flex-col gap-5 print:gap-3">
        {t.guide.sections.map((section) => (
          <section key={section.title} className="flex flex-col gap-2 rounded-card bg-surface p-4 break-inside-avoid print:p-0">
            <h2 className="font-display text-lg">{section.title}</h2>
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-body leading-relaxed">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </PageShell>
  );
}
