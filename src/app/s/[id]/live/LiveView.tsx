"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { FeedbackBanner, type UndoOffer } from "@/components/session/FeedbackBanner";
import { OutboxStatus } from "@/components/session/OutboxStatus";
import { BackLink, Button, Notice, PageShell, Toggle } from "@/components/ui";
import { ChevronRightIcon, DotIcon, PlusIcon, QrIcon } from "@/components/ui/icons";
import { formatCourts } from "@/lib/format";
import { courtFormatLabel } from "@/lib/session/validation";
import { ONLINE_ONLY_MESSAGE, isNetworkError, type OutboxItem, type OutboxKind } from "@/lib/outbox/rules";
import { useOutbox } from "@/lib/outbox/useOutbox";
import type { LiveState } from "@/lib/queue/data";
import { useSessionSync } from "@/lib/realtime/useSessionSync";
import { formatTimeRange } from "@/lib/session/time";
import { undoDeadlineFromNow } from "@/lib/undo/countdown";
import { sendOrganizerAction } from "../outbox-send";
import { undoLastAction } from "../undo-actions";
import { CourtCard } from "./CourtCard";
import { QueueList } from "./QueueList";
import { SessionControls } from "./SessionControls";
import { useTagatawag } from "./useTagatawag";

type Props = {
  session: {
    id: string;
    name: string;
    rotation: string;
    startsAt: string;
    endsAt: string;
    courtsCount: number;
    fee: number;
    payFirst: boolean;
  };
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
  // D18: "Ibalik" for the last finish / removal, for 30 seconds from the tap.
  const [undoOffer, setUndoOffer] = useState<UndoOffer | null>(null);
  if (incomingBanner && incomingBanner.key !== shownKey) {
    setShownKey(incomingBanner.key);
    setBanner(incomingBanner.text);
    setUndoOffer(null);
  }
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const sync = useSessionSync(session.id);
  // D17: read new calls aloud on this phone.
  const tagatawag = useTagatawag(state.courts, sync);

  // The walk-in banner arrives via ?added=…; drop it from the URL so a reload doesn't repeat it.
  useEffect(() => {
    if (incomingBanner && window.location.search) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [incomingBanner]);

  // NF10: without signal, actions wait in the outbox and are sent in order later.
  const outbox = useOutbox(session.id, sendOrganizerAction);

  function act(kind: OutboxKind, args: OutboxItem["args"], label: string): Promise<boolean> {
    const deadline = undoDeadlineFromNow();
    return new Promise((resolve) => {
      startTransition(async () => {
        let outcome;
        try {
          outcome = await outbox.perform({ kind, args, label });
        } catch {
          setError("May nagkaproblema. Subukan ulit.");
          setBanner(null);
          setUndoOffer(null);
          resolve(false);
          return;
        }
        if (outcome.queued) {
          // Shown under "Hinihintay ang signal"; counts as done for the screen.
          setError(null);
          setBanner(null);
          setUndoOffer(null);
          resolve(true);
          return;
        }
        const { result } = outcome;
        if (result.error) {
          setError(result.error);
          setBanner(null);
          setUndoOffer(null);
        } else {
          setError(null);
          setBanner(result.banner ?? null);
          setUndoOffer(result.undo ? { deadline, doneBanner: result.undo.banner } : null);
        }
        resolve(!result.error);
      });
    });
  }

  function undo(offer: UndoOffer) {
    if (!navigator.onLine) {
      setError(ONLINE_ONLY_MESSAGE);
      return;
    }
    startTransition(async () => {
      try {
        const result = await undoLastAction(session.id);
        setUndoOffer(null);
        setError(result.error ?? null);
        setBanner(result.error ? null : offer.doneBanner);
      } catch (caught) {
        setError(isNetworkError(caught) ? ONLINE_ONLY_MESSAGE : "May nagkaproblema. Subukan ulit.");
      }
    });
  }

  const courtById = new Map(state.courts.map((c) => [c.id, c]));
  const nameOf = (playerId: string) =>
    state.queue.find((p) => p.id === playerId)?.name ??
    state.courts.flatMap((c) => c.game?.players ?? []).find((p) => p.id === playerId)?.name ??
    "player";
  // Courts with an action waiting for signal: their buttons wait too, so nobody taps twice.
  const waitingCourts = new Set(outbox.pending.map((item) => item.args.courtId).filter((id): id is string => typeof id === "string"));

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
          <OutboxStatus online={outbox.online} pending={outbox.pending} failed={outbox.failed} onDiscard={outbox.discardFailed} />
          {sync === "lost" && outbox.online && (
            <Notice kind="error">Nawalan ng koneksyon. Sinusubukang kumonekta ulit…</Notice>
          )}
          {error && <Notice kind="error">{error}</Notice>}
          {banner && (
            <FeedbackBanner
              text={banner}
              onClose={() => {
                setBanner(null);
                setUndoOffer(null);
              }}
              undo={undoOffer && { deadline: undoOffer.deadline, onUndo: () => undo(undoOffer), disabled: busy }}
            />
          )}
        </div>

        <div className="flex flex-col gap-3">
          <dl className="grid grid-cols-2 gap-3">
            <Stat label="Naglalaro" value={state.playingCount} />
            <Stat label="Nakapila" value={nakapila} />
          </dl>
          {session.fee > 0 && (
            <Link
              href={`/s/${session.id}/payments`}
              className="flex min-h-14 items-center justify-between gap-3 rounded-card border border-default bg-surface px-4 py-3 shadow-card hover:bg-subtle focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <span className="text-muted">Bayad</span>
              <span className="flex items-center gap-1 font-display text-2xl font-semibold">
                {state.payments.paid}/{state.payments.total}
                <ChevronRightIcon className="size-5 text-muted" />
              </span>
            </Link>
          )}
        </div>

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
              waiting={waitingCourts.has(court.id)}
              onCall={(courtId) => void act("call_next", { courtId }, `Tawagin sa ${courtById.get(courtId)?.label ?? "court"}`)}
              onFinish={(courtId, gameId, winners) =>
                void act(
                  "finish_game",
                  { courtId, gameId, winnerIds: winners },
                  `Tapos na: Laro #${court.game?.number ?? "?"} sa ${court.label}`,
                )
              }
              onSwap={(courtId, playerId) =>
                void act("swap_not_ready", { courtId, playerId }, `Palitan si ${nameOf(playerId)} sa ${court.label}`)
              }
              onSetFormat={(courtId, format) =>
                void act("set_court_format", { courtId, format }, `Gawing ${courtFormatLabel(format)} ang ${court.label}`)
              }
            />
          ))}
        </section>

        <section aria-labelledby="queue-heading" className="flex flex-col gap-3">
          <h2 id="queue-heading" className="text-2xl">
            Susunod sa pila
          </h2>
          <QueueList
            queue={state.queue}
            rules={{ payFirst: session.payFirst, fee: session.fee }}
            busy={busy}
            sessionId={session.id}
            onPause={(playerId) => act("pause_player", { playerId }, `I-pause si ${nameOf(playerId)}`)}
            onResume={(playerId) => act("resume_player", { playerId }, `Ituloy si ${nameOf(playerId)}`)}
            onRemove={(playerId) => act("remove_player", { playerId }, `Alisin si ${nameOf(playerId)} sa pila`)}
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
          {tagatawag.supported && (
            <div onChange={(event) => tagatawag.setEnabled((event.target as HTMLInputElement).checked)}>
              <Toggle
                label="Tagatawag (basahin nang malakas ang tawag)"
                description="Isang phone lang ang naka-on, para hindi doble ang boses"
                name="tagatawag"
                defaultChecked={tagatawag.enabled}
              />
            </div>
          )}
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
