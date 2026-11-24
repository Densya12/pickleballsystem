"use client";

import { useEffect } from "react";
import { BackLink, Button, PageShell } from "@/components/ui";

/** Unexpected errors on any page: Taglish, with a retry and the way back. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageShell
      header={
        <div className="flex flex-col gap-2">
          <BackLink href="/" />
          <h1 className="text-3xl">May nagkaproblema. Subukan ulit.</h1>
          <p className="text-muted">
            Hindi natapos ang ginagawa mo. Kung mahina ang signal, hintayin munang bumalik ito.
          </p>
        </div>
      }
    >
      <div className="flex flex-col gap-3 pt-4">
        <Button size="lg" fullWidth onClick={() => reset()}>
          Subukan ulit
        </Button>
        {error.digest && <p className="text-sm text-muted">Code: {error.digest}</p>}
      </div>
    </PageShell>
  );
}
