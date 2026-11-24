"use client";

import { useState, useTransition } from "react";
import { Button, Notice } from "@/components/ui";
import { BallIcon, StopIcon } from "@/components/ui/icons";
import type { SessionStatus } from "@/lib/session/data";
import {
  deleteDraftSessionAction,
  endSessionAction,
  startSessionAction,
  type SessionActionResult,
} from "./actions";

type Confirming = "end" | "delete" | null;

/** Draft: start or delete. Live: end, after a confirmation step. Ended: nothing. */
export function SessionControls({ sessionId, status }: { sessionId: string; status: SessionStatus }) {
  const [error, setError] = useState<string>();
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [busy, startTransition] = useTransition();

  function run(action: (id: string) => Promise<SessionActionResult>) {
    setError(undefined);
    startTransition(async () => {
      const result = await action(sessionId);
      if (result.error) setError(result.error);
      setConfirming(null);
    });
  }

  if (status === "ended") return null;

  return (
    <div className="flex flex-col gap-3">
      {error && <Notice kind="error">{error}</Notice>}

      {status === "draft" && (
        <>
          <Button size="lg" fullWidth disabled={busy} onClick={() => run(startSessionAction)}>
            <BallIcon />
            {busy && confirming === null ? "Sinisimulan…" : "Simulan ang session"}
          </Button>
          {confirming === "delete" ? (
            <ConfirmBox
              question="Burahin ang draft na ito?"
              confirmLabel={busy ? "Binubura…" : "Oo, burahin"}
              busy={busy}
              onConfirm={() => run(deleteDraftSessionAction)}
              onCancel={() => setConfirming(null)}
            />
          ) : (
            <Button variant="danger-outline" fullWidth disabled={busy} onClick={() => setConfirming("delete")}>
              Burahin
            </Button>
          )}
        </>
      )}

      {status === "live" &&
        (confirming === "end" ? (
          <ConfirmBox
            question="Sigurado ka? Magsasara ang check-in."
            confirmLabel={busy ? "Tinatapos…" : "Oo, tapusin"}
            busy={busy}
            onConfirm={() => run(endSessionAction)}
            onCancel={() => setConfirming(null)}
          />
        ) : (
          <Button variant="danger-outline" size="lg" fullWidth onClick={() => setConfirming("end")}>
            <StopIcon />
            Tapusin ang session
          </Button>
        ))}
    </div>
  );
}

function ConfirmBox({
  question,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  question: string;
  confirmLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div role="group" aria-label={question} className="flex flex-col gap-2 rounded-control bg-subtle p-4">
      <p className="font-semibold">{question}</p>
      <Button variant="danger-outline" fullWidth disabled={busy} onClick={onConfirm}>
        {confirmLabel}
      </Button>
      <Button variant="secondary" fullWidth disabled={busy} onClick={onCancel}>
        Huwag muna
      </Button>
    </div>
  );
}
