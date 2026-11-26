import type { Metadata } from "next";
import { Suspense } from "react";
import { LanguageSwitch } from "@/components/i18n/LanguageSwitch";
import { Button, PageShell } from "@/components/ui";
import { en } from "@/lib/i18n/dictionary";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: en.player.byeTitle,
};

/** After leaving (BR18). Joining again puts the player at the end of the queue. */
export default function ByePage({ params }: PageProps<"/j/[code]/bye">) {
  return (
    <Suspense fallback={<PageShell>{null}</PageShell>}>
      <Bye params={params} />
    </Suspense>
  );
}

async function Bye({ params }: Pick<PageProps<"/j/[code]/bye">, "params">) {
  const [{ code }, t] = await Promise.all([params, getT()]);
  return (
    <PageShell
      top={
        <>
          <span />
          <LanguageSwitch />
        </>
      }
      title={t.player.byeTitle}
      subtitle={t.player.byeBody}
      footer={
        <Button href={`/j/${encodeURIComponent(code)}`} fullWidth>
          {t.player.joinAgain}
        </Button>
      }
    >
      {null}
    </PageShell>
  );
}
