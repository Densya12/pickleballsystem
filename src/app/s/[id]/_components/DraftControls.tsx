"use client";

import { useState, useTransition } from "react";
import { Button, Notice } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import { isNetworkError } from "@/lib/outbox/rules";
import { deleteDraftSessionAction, startSessionAction, type SessionActionResult } from "../_lib/session-actions";

/** Draft: Start session (main button), or delete after a confirm step. */
export function DraftControls({ sessionId }: { sessionId: string }) {
  const t = useT();
  const [error, setError] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  const [busy, startTransition] = useTransition();

  function run(action: (id: string) => Promise<SessionActionResult>) {
    // Never queued offline (NF10): starting and deleting need the server's answer now.
    if (!navigator.onLine) {
      setError(t.live.onlineOnly);
      return;
    }
    setError(undefined);
    startTransition(async () => {
      try {
        const result = await action(sessionId);
        if (result?.error) setError(result.error);
      } catch (caught) {
        // Anything else (including Next's redirect after deleting) is handled by Next.
        if (!isNetworkError(caught)) throw caught;
        setError(t.live.onlineOnly);
      }
      setConfirming(false);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <Notice kind="error">{error}</Notice>}
      {confirming ? (
        <div role="group" aria-label={t.session.deleteDraftQuestion} className="flex flex-col gap-2 rounded-group bg-surface p-4">
          <p className="font-medium">{t.session.deleteDraftQuestion}</p>
          <Button variant="danger-outline" size="md" fullWidth disabled={busy} onClick={() => run(deleteDraftSessionAction)}>
            {busy ? t.session.deleting : t.session.yesDelete}
          </Button>
          <Button variant="ghost" size="md" fullWidth disabled={busy} onClick={() => setConfirming(false)}>
            {t.common.cancel}
          </Button>
        </div>
      ) : (
        <>
          <Button size="lg" fullWidth disabled={busy} onClick={() => run(startSessionAction)}>
            {busy ? t.session.starting : t.session.start}
          </Button>
          <Button variant="danger" size="md" fullWidth disabled={busy} onClick={() => setConfirming(true)}>
            {t.session.deleteDraft}
          </Button>
        </>
      )}
    </div>
  );
}
