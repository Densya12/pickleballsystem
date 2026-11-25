"use client";

import { useEffect } from "react";
import { BackLink, Button, PageShell } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

/** Unexpected errors on any page: in the device's language, with a retry and the way back. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageShell
      top={<BackLink href="/" label={t.nav.home} />}
      title={t.system.errorTitle}
      subtitle={t.system.errorBody}
      footer={
        <Button fullWidth onClick={() => reset()}>
          {t.common.retry}
        </Button>
      }
    >
      {error.digest && <p className="px-1 text-xs text-muted">{t.system.errorCode(error.digest)}</p>}
    </PageShell>
  );
}
