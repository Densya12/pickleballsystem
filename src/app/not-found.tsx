import type { Metadata } from "next";
import { Suspense } from "react";
import { Button, PageShell } from "@/components/ui";
import { en } from "@/lib/i18n/dictionary";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: `${en.system.notFoundPageTitle} · ${en.common.appName}`,
};

/** Unknown pages, and sessions or clubs the user isn't staff of. */
export default function NotFound() {
  return (
    <Suspense fallback={<PageShell>{null}</PageShell>}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const t = await getT();
  return (
    <PageShell title={t.system.notFoundTitle} titleSize="xl" subtitle={t.system.notFoundBody} footer={<Button href="/" fullWidth>{t.system.goHome}</Button>}>
      {null}
    </PageShell>
  );
}
