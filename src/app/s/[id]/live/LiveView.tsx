"use client";

import { useEffect, useState, useTransition } from "react";
import { BackLink, Button, Notice, PageShell } from "@/components/ui";
import { DotIcon, PlusIcon, QrIcon } from "@/components/ui/icons";
import { formatCourts } from "@/lib/format";
import type { LiveState } from "@/lib/queue/data";
import { useSessionSync } from "@/lib/realtime/useSessionSync";
import { formatTimeRange } from "@/lib/session/time";
import { CourtCard } from "./CourtCard";
import {
  callNextAction,
  finishGameAction,
  pausePlayerAction,
  removePlayerAction,
  resumePlayerAction,
  setCourtFormatAction,
  swapNotReadyAction,
  type QueueActionResult,
} from "./queue-actions";
import { QueueList } from "./QueueList";
import { SessionControls } from "./SessionControls";

type Props = {
  session: { id: string; name: string; rotation: string; startsAt: string; endsAt: string; courtsCount: number };
  state: LiveState;
  /** A banner from another page (adding a walk-in), keyed so each one shows once. */
  incomingBanner?: { key: string; text: string } | null;
};

/** "Live na open play": run the courts and the queue from one phone. */
export function LiveView({ session, state, incomingBanner }: Props) {
  const [banner, setBanner] = useState<string | null>(incomingBanner?.text ?? null);
  // This component stays mounted across navigations, so pick up a new incoming
  // banner when its key changes (adjusting state during render, not in an effect).
  const [shownKey, setShownKey] = useState(incomingBanner?.key ?? null);
  if (incomingBanner && incomingBanner.key !== shownKey) {
    setShownKey(incomingBanner.key);
    setBanner(incomingBanner.text);
  }
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const sync = useSessionSync(session.id);

  // The walk-in banner arrives via ?added=…; drop it from the URL so a reload doesn't repeat it.
  useEffect(() => {
    if (incomingBanner && window.location.search) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [incomingBanner]);

  function run(action: () => Promise<QueueActionResult>): Promise<boolean> {
    return new Promise((resolve) => {
      startTransition(async () => {
        const result = await action();
        if (result.error) {
          setError(result.error);
          setBanner(null);
        } else {
          setError(null);
          setBanner(result.banner ?? null);
        }
        resolve(!result.error);
      });
    });
  }

  const nakapila = state.queue.length;

  return (
    <PageShell
      header={
        <div className="flex flex-col gap-2">
          <BackLink href="/" />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-sm font-bold tracking-wide text-ink">
              <DotIcon className="size-3.5 shrink-0" />
              LIVE
            </span>
            <span className="text-muted">
              {formatTimeRange(new Date(session.startsAt), new Date(session.endsAt))} · {formatCourts(session.courtsCount)}
            </span>
          </div>
          <h1 className="text-3xl break-words">{session.name}</h1>
        </div>
      }
    >
      <div className="flex flex-col gap-6" data-live-sync={sync}>
        <div className="flex flex-col gap-2" aria-live="polite">
          {sync === "lost" && (
            <Notice kind="error">Nawalan ng koneksyon. Sinusubukang kumonekta ulit…</Notice>
          )}
          {error && <Notice kind="error">{error}</Notice>}
          {banner && (
            <Notice kind="success">
              <div className="flex items-start justify-between gap-3">
                <span>{banner}</span>
                <button
                  type="button"
                  onClick={() => setBanner(null)}
                  className="-my-2 -mr-2 min-h-12 shrink-0 rounded-control px-3 font-semibold underline underline-offset-2 focus-visible:outline-3 focus-visible:outline-focus"
                >
                  Isara
                </button>
              </div>
            </Notice>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-3">
          <Stat label="Naglalaro" value={state.playingCount} />
          <Stat label="Nakapila" value={nakapila} />
        </dl>

        <section aria-labelledby="courts-heading" className="flex flex-col gap-3">
          <h2 id="courts-heading" className="text-2xl">
            Mga court
          </h2>
          {state.courts.map((court) => (
            <CourtCard
              key={`${court.id}:${court.game?.id ?? "empty"}`}
              court={court}
              rotation={session.rotation}
              eligibleCount={state.eligibleCount}
              busy={busy}
              onCall={(courtId) => void run(() => callNextAction(session.id, courtId))}
              onFinish={(courtId, gameId, winners) =>
                void run(() => finishGameAction(session.id, courtId, gameId, winners))
              }
              onSwap={(courtId, playerId) => void run(() => swapNotReadyAction(session.id, courtId, playerId))}
              onSetFormat={(courtId, format) => void run(() => setCourtFormatAction(session.id, courtId, format))}
            />
          ))}
        </section>

        <section aria-labelledby="queue-heading" className="flex flex-col gap-3">
          <h2 id="queue-heading" className="text-2xl">
            Susunod sa pila
          </h2>
          <QueueList
            queue={state.queue}
            busy={busy}
            onPause={(playerId) => run(() => pausePlayerAction(session.id, playerId))}
            onResume={(playerId) => run(() => resumePlayerAction(session.id, playerId))}
            onRemove={(playerId) => run(() => removePlayerAction(session.id, playerId))}
          />
        </section>

        <section aria-label="Iba pang gagawin" className="flex flex-col gap-3 border-t border-default pt-6">
          <Button href={`/s/${session.id}/walk-in`} size="lg" fullWidth>
            <PlusIcon />
            Walk-in
          </Button>
          <Button href={`/s/${session.id}/qr`} variant="secondary" fullWidth>
            <QrIcon />
            Ipakita ang QR
          </Button>
          <SessionControls sessionId={session.id} status="live" />
        </section>
      </div>
    </PageShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col rounded-card border border-default bg-surface px-4 py-3 shadow-card">
      <dt className="text-muted">{label}</dt>
      <dd className="font-display text-3xl font-semibold">{value}</dd>
    </div>
  );
}
