"use client";

import { useState, useTransition, type ReactNode } from "react";
import { FeedbackBanner, type UndoOffer } from "@/components/session/FeedbackBanner";
import { OutboxStatus } from "@/components/session/OutboxStatus";
import { Button, Card, Notice, PageShell, StatusLabel } from "@/components/ui";
import { AlertIcon, CheckIcon, ClockIcon } from "@/components/ui/icons";
import { formatPeso } from "@/lib/format";
import { isNetworkError, ONLINE_ONLY_MESSAGE } from "@/lib/outbox/rules";
import { useOutbox } from "@/lib/outbox/useOutbox";
import { reminderMessage } from "@/lib/payments/messages";
import { sendReminder } from "@/lib/payments/remind";
import { maskReference } from "@/lib/payments/reference";
import { duplicateReferences, summarizePayments, type PayingPlayer } from "@/lib/payments/summary";
import { useSessionSync } from "@/lib/realtime/useSessionSync";
import { undoDeadlineFromNow } from "@/lib/undo/countdown";
import { undoLastAction } from "../undo-actions";
import { sendOrganizerAction } from "../outbox-send";
import { undoPaymentAction, type PaymentActionResult } from "./actions";

type Props = {
  header: ReactNode;
  session: {
    id: string;
    name: string;
    fee: number;
    payFirst: boolean;
    status: string;
    gcashName: string | null;
    gcashNumber: string | null;
  };
  players: PayingPlayer[];
};

/** Bayad: clear at a glance who has paid (D16). The app only records; it never moves money. */
export function PaymentsView({ header, session, players }: Props) {
  const sync = useSessionSync(session.id);
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  // D18: "Ibalik" for the last "Natanggap na", for 30 seconds from the tap.
  const [undoOffer, setUndoOffer] = useState<UndoOffer | null>(null);

  const summary = summarizePayments(players, session.fee, { sessionEnded: session.status === "ended" });
  const duplicates = duplicateReferences(players);

  // NF10: "Natanggap na" without signal waits in the outbox.
  const outbox = useOutbox(session.id, sendOrganizerAction);

  function confirm(player: PayingPlayer) {
    const deadline = undoDeadlineFromNow();
    startTransition(async () => {
      const outcome = await outbox.perform({
        kind: "confirm_payment",
        args: { playerId: player.id },
        label: `Natanggap na: ${player.name}`,
      });
      if (outcome.queued) {
        setError(null);
        setBanner(null);
        setUndoOffer(null);
        return;
      }
      const { result } = outcome;
      setError(result.error ?? null);
      setBanner(result.error ? null : (result.banner ?? null));
      setUndoOffer(!result.error && result.undo ? { deadline, doneBanner: result.undo.banner } : null);
    });
  }

  function run(action: () => Promise<PaymentActionResult>) {
    if (!navigator.onLine) {
      setError(ONLINE_ONLY_MESSAGE);
      return;
    }
    startTransition(async () => {
      try {
        const result = await action();
        setError(result.error ?? null);
        setBanner(result.error ? null : (result.banner ?? null));
        setUndoOffer(null);
      } catch (caught) {
        if (!isNetworkError(caught)) throw caught;
        setError(ONLINE_ONLY_MESSAGE);
      }
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
        if (!isNetworkError(caught)) throw caught;
        setError(ONLINE_ONLY_MESSAGE);
      }
    });
  }

  async function remind(player: PayingPlayer) {
    const text = reminderMessage({
      name: player.name,
      session: session.name,
      fee: session.fee,
      gcashName: session.gcashName,
      gcashNumber: session.gcashNumber,
    });
    setError(null);
    setUndoOffer(null);
    const outcome = await sendReminder(player.name, text);
    if (outcome.banner) setBanner(outcome.banner);
    if (outcome.error) setError(outcome.error);
  }

  return (
    <PageShell
      header={
        <div className="flex flex-col gap-1">
          {header}
          <p className="text-muted [overflow-wrap:anywhere]">{session.name}</p>
          <h1 className="text-3xl">Bayad</h1>
          {session.fee > 0 && <p className="text-muted">{formatPeso(session.fee)} bawat player</p>}
        </div>
      }
    >
      <div className="flex flex-col gap-6" data-live-sync={sync}>
        <div className="flex flex-col gap-2" aria-live="polite">
          <OutboxStatus online={outbox.online} pending={outbox.pending} failed={outbox.failed} onDiscard={outbox.discardFailed} />
          {sync === "lost" && outbox.online && <Notice kind="error">Nawalan ng koneksyon. Sinusubukang kumonekta ulit…</Notice>}
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

        {session.fee === 0 ? (
          <Notice kind="info">Libre ang session na ito. Walang bayad na kailangang i-check.</Notice>
        ) : players.length === 0 ? (
          <Empty>Wala pang player kaya wala pang bayad. Ipakita ang QR o magdagdag ng walk-in.</Empty>
        ) : (
          <>
            <Card className="flex flex-col gap-1">
              <p className="font-display text-3xl font-semibold">
                {formatPeso(summary.confirmedTotal)} <span className="text-xl text-muted">sa {formatPeso(summary.expectedTotal)}</span>
              </p>
              <p className="font-semibold" data-testid="payment-counts">
                {summary.confirmed.length} bayad · {summary.pending.length} i-check · {summary.unpaid.length} hindi pa
              </p>
            </Card>

            <Section title={`I-check sa GCash mo (${summary.pending.length})`} id="check">
              <p className="text-muted">
                Buksan ang GCash mo at hanapin ang reference number bago pindutin ang Natanggap na.
              </p>
              {summary.pending.length === 0 ? (
                <Empty>Walang i-check ngayon.</Empty>
              ) : (
                summary.pending.map((player) => (
                  <Card key={player.id} role="group" aria-label={player.name} className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold [overflow-wrap:anywhere]">{player.name}</p>
                      <StatusLabel kind="pending" className="shrink-0" />
                    </div>
                    {player.referenceDigits && <Reference digits={player.referenceDigits} />}
                    {duplicates.has(player.id) && (
                      <p className="flex items-start gap-2 rounded-control bg-warn px-3 py-2 font-semibold text-warn">
                        <AlertIcon className="mt-0.5 size-5 shrink-0" />
                        <span>Parehong reference kay {duplicates.get(player.id)!.join(", ")}</span>
                      </p>
                    )}
                    <Button fullWidth disabled={busy} onClick={() => confirm(player)}>
                      <CheckIcon />
                      Natanggap na
                    </Button>
                  </Card>
                ))
              )}
            </Section>

            <Section title={`Hindi pa bayad (${summary.unpaid.length})`} id="unpaid">
              {summary.unpaid.length === 0 ? (
                <Empty>Bayad na ang lahat.</Empty>
              ) : (
                summary.unpaid.map((player) => (
                  <Card key={player.id} role="group" aria-label={player.name} className="flex flex-col gap-3">
                    <div className="flex flex-col">
                      <p className="font-semibold [overflow-wrap:anywhere]">{player.name}</p>
                      <p className="text-muted">
                        {session.payFirst ? "Naka-hold" : "Nakapila pero wala pang bayad"}
                        {player.method === "cash" ? " · cash ang sabi" : ""}
                      </p>
                    </div>
                    <Button fullWidth disabled={busy} onClick={() => confirm(player)}>
                      <CheckIcon />
                      Natanggap na (cash)
                    </Button>
                    <Button variant="secondary" fullWidth onClick={() => void remind(player)}>
                      Paalalahanan
                    </Button>
                  </Card>
                ))
              )}
            </Section>

            <details className="group flex flex-col gap-3">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between rounded-control px-1 text-2xl font-semibold [font-family:var(--font-display)] focus-visible:outline-3 focus-visible:outline-focus">
                <span>Bayad na ({summary.confirmed.length})</span>
                <span className="text-base font-semibold text-muted">
                  <span className="group-open:hidden">Ipakita</span>
                  <span className="hidden group-open:inline">Itago</span>
                </span>
              </summary>
              <div className="mt-3 flex flex-col gap-3">
                {summary.confirmed.length === 0 ? (
                  <Empty>Wala pang bayad.</Empty>
                ) : (
                  summary.confirmed.map((player) => (
                    <PaidRow
                      key={player.id}
                      player={player}
                      busy={busy}
                      onUndo={() => run(() => undoPaymentAction(session.id, player.id))}
                    />
                  ))
                )}
              </div>
            </details>
          </>
        )}
      </div>
    </PageShell>
  );
}

/** Last 4 digits; tap to show all. */
function Reference({ digits }: { digits: string }) {
  const [shown, setShown] = useState(false);
  return (
    <button
      type="button"
      aria-expanded={shown}
      onClick={() => setShown((value) => !value)}
      className="flex min-h-12 items-center justify-between gap-3 rounded-control bg-subtle px-4 py-2 text-left focus-visible:outline-3 focus-visible:outline-focus"
    >
      <span>
        <span className="block text-sm text-muted">GCash reference</span>
        <span className="font-display text-xl font-semibold tracking-wider">{shown ? digits : maskReference(digits)}</span>
      </span>
      <span className="text-base font-semibold underline underline-offset-2">{shown ? "Itago" : "Ipakita lahat"}</span>
    </button>
  );
}

function PaidRow({ player, busy, onUndo }: { player: PayingPlayer; busy: boolean; onUndo: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <Card role="group" aria-label={player.name} className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold [overflow-wrap:anywhere]">{player.name}</p>
          <p className="text-muted">
            {player.method === "gcash" ? `GCash${player.referenceDigits ? ` · ${maskReference(player.referenceDigits)}` : ""}` : "Cash"}
            {player.status === "left" ? " · umalis na" : ""}
          </p>
        </div>
        <StatusLabel kind="paid" className="shrink-0" />
      </div>
      {confirming ? (
        <div role="group" aria-label={`Ibalik si ${player.name} sa hindi pa bayad?`} className="flex flex-col gap-2 rounded-control border-[1.5px] border-ink bg-surface p-4">
          <p className="font-semibold">Ibalik si {player.name} sa hindi pa bayad?</p>
          <Button
            variant="danger-outline"
            fullWidth
            disabled={busy}
            onClick={() => {
              setConfirming(false);
              onUndo();
            }}
          >
            Oo, ibalik
          </Button>
          <Button variant="secondary" fullWidth disabled={busy} onClick={() => setConfirming(false)}>
            Huwag
          </Button>
        </div>
      ) : (
        <Button variant="secondary" fullWidth disabled={busy} onClick={() => setConfirming(true)}>
          <ClockIcon />
          Ibalik sa hindi pa bayad
        </Button>
      )}
    </Card>
  );
}

function Section({ title, id, children }: { title: string; id: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-3">
      <h2 id={`${id}-heading`} className="text-2xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-card border border-dashed border-strong px-5 py-4 text-muted">{children}</p>;
}
