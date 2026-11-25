"use client";

import { useState } from "react";
import { Button, EmptyState, IconButton, ListGroup, Notice, Section } from "@/components/ui";
import { AlertIcon, BellIcon, ChevronRightIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { formatPeso } from "@/lib/format";
import { useT } from "@/lib/i18n/client";
import { reminderMessage } from "@/lib/payments/messages";
import { maskReference } from "@/lib/payments/reference";
import { sendReminder } from "@/lib/payments/remind";
import { duplicateReferences, summarizePayments, type PayingPlayer } from "@/lib/payments/summary";
import { undoPaymentAction } from "../_lib/payment-actions";
import { useSessionFrame } from "./SessionFrame";

type Props = {
  session: { id: string; name: string; fee: number; payFirst: boolean; status: string; gcashName: string | null; gcashNumber: string | null };
  players: PayingPlayer[];
};

/** Payments (D16, D19): who to check in GCash, who still owes, who has paid. The app only records. */
export function PaymentsView({ session, players }: Props) {
  const t = useT();
  const { act, runOnline, busy, showError } = useSessionFrame();
  const summary = summarizePayments(players, session.fee, { sessionEnded: session.status === "ended" });
  const duplicates = duplicateReferences(players);
  const [reminded, setReminded] = useState<string | null>(null);

  if (session.fee === 0) return <Notice kind="info">{t.payments.freeSession}</Notice>;
  if (players.length === 0) return <EmptyState>{t.payments.noPlayers}</EmptyState>;

  const counted = summary.counted.length || 1;
  const paidShare = (summary.confirmed.length / counted) * 100;
  const checkShare = (summary.pending.length / counted) * 100;

  async function remind(player: PayingPlayer) {
    setReminded(null);
    const outcome = await sendReminder(
      player.name,
      reminderMessage(
        { name: player.name, session: session.name, fee: session.fee, gcashName: session.gcashName, gcashNumber: session.gcashNumber },
        t,
      ),
      t,
    );
    if (outcome.banner) setReminded(outcome.banner);
    if (outcome.error) showError(outcome.error);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-card bg-surface p-4">
        <p className="flex items-baseline gap-1.5">
          <span className="font-display text-[30px] leading-none font-semibold">{formatPeso(summary.confirmedTotal)}</span>
          <span className="[font-size:14px] text-muted">{t.payments.ofTotal(formatPeso(summary.expectedTotal))}</span>
        </p>
        <div
          role="img"
          aria-label={t.payments.progress(summary.confirmed.length, summary.pending.length, summary.counted.length)}
          className="mt-3 flex h-1.5 overflow-hidden rounded-full"
          style={{ backgroundColor: "#eeeeea" }}
        >
          <div className="bg-live" style={{ width: `${paidShare}%` }} />
          <div className="bg-accent" style={{ width: `${checkShare}%` }} />
        </div>
        <p className="mt-2.5 text-sm text-muted" data-testid="payment-counts">
          {t.payments.summaryLine(summary.confirmed.length, summary.pending.length, summary.unpaid.length, formatPeso(session.fee))}
        </p>
      </div>

      {reminded && (
        <div aria-live="polite">
          <Notice kind="success">{reminded}</Notice>
        </div>
      )}

      {summary.pending.length > 0 && (
        <Section id="check" label={t.payments.checkGcash}>
          <ListGroup>
            {summary.pending.map((player) => (
              <li key={player.id} role="group" aria-label={player.name} className="flex items-center gap-3 px-4 py-3">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium [overflow-wrap:anywhere]">{player.name}</span>
                  {player.referenceDigits && <Reference name={player.name} digits={player.referenceDigits} />}
                  {duplicates.has(player.id) && (
                    <span className="flex items-start gap-1 text-sm font-medium text-warn">
                      <AlertIcon className="mt-0.5 size-3.5 shrink-0" />
                      {t.payments.sameRef(duplicates.get(player.id)!.join(", "))}
                    </span>
                  )}
                </div>
                <Button
                  variant="lime"
                  size="sm"
                  aria-label={t.payments.receivedFrom(player.name)}
                  disabled={busy}
                  onClick={() => void act("confirm_payment", { playerId: player.id }, t.live.outboxConfirm(player.name))}
                >
                  {t.payments.received}
                </Button>
              </li>
            ))}
          </ListGroup>
          <p className="mx-1 mt-2 text-xs text-muted">{t.payments.checkHint}</p>
        </Section>
      )}

      {summary.unpaid.length > 0 && (
        <Section id="unpaid" label={t.payments.unpaid}>
          <ListGroup>
            {summary.unpaid.map((player) => (
              <li key={player.id} role="group" aria-label={player.name} className="flex items-center gap-2 px-4 py-3">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium [overflow-wrap:anywhere]">{player.name}</span>
                  <span className={cn("text-sm", session.payFirst && session.status !== "ended" ? "text-warn" : "text-muted")}>
                    {player.method === "cash"
                      ? t.payments.payingCash
                      : session.payFirst && session.status !== "ended"
                        ? t.payments.mustPayFirst
                        : t.payments.notPaidYet}
                  </span>
                </div>
                <IconButton label={t.payments.remind(player.name)} look="outline" size="sm" onClick={() => void remind(player)}>
                  <BellIcon className="size-4" />
                </IconButton>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={t.payments.cashFrom(player.name)}
                  disabled={busy}
                  onClick={() => void act("confirm_payment", { playerId: player.id }, t.live.outboxConfirm(player.name))}
                >
                  {t.payments.cash}
                </Button>
              </li>
            ))}
          </ListGroup>
        </Section>
      )}

      <PaidList
        players={summary.confirmed}
        busy={busy}
        onUndo={(player) => void runOnline(() => undoPaymentAction(session.id, player.id))}
      />
    </div>
  );
}

/** "Ref •••• 7890"; tap to show all digits. */
function Reference({ name, digits }: { name: string; digits: string }) {
  const t = useT();
  const [shown, setShown] = useState(false);
  return (
    <button
      type="button"
      aria-expanded={shown}
      aria-label={shown ? t.payments.hideRef(name) : t.payments.showRef(name)}
      onClick={() => setShown((v) => !v)}
      className="touch-target self-start text-sm text-muted tabular-nums underline-offset-2 hover:underline"
    >
      {t.payments.ref(shown ? digits : maskReference(digits))}
    </button>
  );
}

function PaidList({ players, busy, onUndo }: { players: PayingPlayer[]; busy: boolean; onUndo: (player: PayingPlayer) => void }) {
  const t = useT();
  return (
    <details className="group overflow-hidden rounded-group bg-surface">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 py-3.5 focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-focus">
        <span className="font-medium">{t.payments.paidList(players.length).replace(/\s*\(\d+\)$/, "")}</span>
        <span className="flex items-center gap-1 [font-size:14px] text-muted">
          {players.length}
          <ChevronRightIcon className="size-4 text-[#9aa09c] transition-transform group-open:rotate-90" />
        </span>
      </summary>
      {players.length === 0 ? (
        <p className="border-t border-hairline px-4 py-3 text-muted">{t.payments.nobodyPaid}</p>
      ) : (
        <ul className="divide-y divide-hairline border-t border-hairline">
          {players.map((player) => (
            <PaidRow key={player.id} player={player} busy={busy} onUndo={() => onUndo(player)} />
          ))}
        </ul>
      )}
    </details>
  );
}

function PaidRow({ player, busy, onUndo }: { player: PayingPlayer; busy: boolean; onUndo: () => void }) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  return (
    <li role="group" aria-label={player.name} className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium [overflow-wrap:anywhere]">{player.name}</span>
          <span className="text-sm text-muted">
            {player.method === "gcash"
              ? `${t.player.gcash}${player.referenceDigits ? ` · ${maskReference(player.referenceDigits)}` : ""}`
              : t.player.cash}
            {player.status === "left" ? ` · ${t.payments.left}` : ""}
          </span>
        </div>
        {!confirming && (
          <Button variant="ghost" size="sm" className="text-muted" disabled={busy} onClick={() => setConfirming(true)}>
            {t.payments.markUnpaid}
          </Button>
        )}
      </div>
      {confirming && (
        <div role="group" aria-label={t.payments.markUnpaidQuestion(player.name)} className="flex flex-col gap-2 rounded-control bg-info p-3">
          <p className="text-sm font-medium">{t.payments.markUnpaidQuestion(player.name)}</p>
          <div className="flex gap-2">
            <Button variant="ghost" size="pill" className="flex-1" disabled={busy} onClick={() => setConfirming(false)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="danger-outline"
              size="pill"
              className="flex-1"
              disabled={busy}
              onClick={() => {
                setConfirming(false);
                onUndo();
              }}
            >
              {t.payments.yesMarkUnpaid}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
