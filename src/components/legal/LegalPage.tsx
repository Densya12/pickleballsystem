import { Suspense } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { BackLink, Card, PageShell } from "@/components/ui";
import { SkeletonLine } from "@/components/ui/Skeleton";
import { getT } from "@/lib/i18n/server";

/**
 * /terms and /privacy (D22): plain pages, reachable signed out. The back link
 * goes to Sign in (where they're linked from); the contact line shows only when
 * NEXT_PUBLIC_CONTACT_EMAIL is set.
 */
export function LegalPage({ kind }: { kind: "terms" | "privacy" }) {
  return (
    <Suspense
      fallback={
        <PageShell titleSkeleton="50%">
          <Card className="flex flex-col gap-2">
            <SkeletonLine width="90%" />
            <SkeletonLine width="80%" />
            <SkeletonLine width="70%" />
          </Card>
        </PageShell>
      }
    >
      <LegalContent kind={kind} />
    </Suspense>
  );
}

async function LegalContent({ kind }: { kind: "terms" | "privacy" }) {
  const t = await getT();
  const sections = kind === "terms" ? t.legal.termsSections : t.legal.privacySections;
  const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();
  return (
    <PageShell
      top={
        <>
          <BackLink href="/login" label={t.auth.pageTitle} />
          <Wordmark className="text-xl" />
        </>
      }
      eyebrow={t.legal.draftLine}
      title={kind === "terms" ? t.legal.termsTitle : t.legal.privacyTitle}
    >
      <div className="flex flex-col gap-3">
        {t.legal.englishNote.show && <p className="px-1 text-sm text-muted">{t.legal.englishNote.text}</p>}
        <Card className="flex flex-col gap-5">
          {sections.map((section) => (
            <section key={section.title} className="flex flex-col gap-2">
              <h2 className="text-lg">{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-secondary">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </Card>
        {contact && (
          <p className="px-1 text-sm text-secondary" data-legal-contact="">
            {t.legal.contact(contact)}
          </p>
        )}
      </div>
    </PageShell>
  );
}
