"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, CopyButton, Input } from "@/components/ui";
import { AlertIcon, CheckIcon, ClockIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { formatGcashNumber, formatPeso } from "@/lib/format";
import { useT } from "@/lib/i18n/client";
import { normalizeReference, REFERENCE_MAX, REFERENCE_MIN } from "@/lib/payments/reference";
import { playerErrorMessage } from "@/lib/player/messages";
import { createClient } from "@/lib/supabase/client";

type Props = {
  playerId: string;
  fee: number;
  payFirst: boolean;
  gcash: { name: string | null; number: string | null };
  payment: { status: string; method: string | null };
};

/** A list row: the player's payment status, and a way to send a GCash reference while unpaid (BR13). */
export function PaymentRow({ playerId, fee, payFirst, gcash, payment }: Props) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  if (fee <= 0) return null;

  const status = payment.status === "confirmed" || payment.status === "pending" ? payment.status : "unpaid";
  const Icon = status === "confirmed" ? CheckIcon : status === "pending" ? ClockIcon : AlertIcon;
  const detail =
    status === "confirmed"
      ? t.player.paymentPaid
      : status === "pending"
        ? t.player.paymentPending
        : payment.method === "cash"
          ? t.player.paymentUnpaidCash
          : t.player.paymentUnpaid;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = String(new FormData(event.currentTarget).get("reference") ?? "");
    if (!normalizeReference(raw)) {
      setError(t.payments.invalidReference(REFERENCE_MIN, REFERENCE_MAX));
      return;
    }
    setBusy(true);
    const { error: rpcError } = await createClient().rpc("player_submit_reference", { p_player_id: playerId, p_reference: raw });
    setBusy(false);
    if (rpcError) {
      setError(playerErrorMessage(rpcError, t));
      return;
    }
    setOpen(false);
    setError(undefined);
    router.refresh();
  }

  return (
    <li aria-label={t.player.payment} className="flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3" data-payment={status}>
        <Icon className={cn("size-5 shrink-0", status === "unpaid" ? "text-warn" : status === "confirmed" ? "text-success" : "text-muted")} />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{t.player.paymentRow(formatPeso(fee))}</p>
          <p className={cn("text-sm", status === "unpaid" ? "text-warn" : "text-muted")}>{detail}</p>
          {status === "unpaid" && payFirst && <p className="text-sm font-medium text-warn">{t.player.heldNote}</p>}
        </div>
      </div>
      {status === "unpaid" &&
        (open ? (
          <form onSubmit={submit} noValidate className="flex flex-col gap-3 border-t border-hairline px-4 py-3">
            {gcash.number && (
              <div className="flex items-center justify-between gap-3 rounded-control bg-info px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm text-muted [overflow-wrap:anywhere]">{t.player.sendTo(gcash.name)}</p>
                  <p className="font-medium">{formatGcashNumber(gcash.number)}</p>
                </div>
                <CopyButton text={gcash.number} label={t.player.copyNumber} />
              </div>
            )}
            <Input label={t.player.reference} name="reference" inputMode="numeric" autoComplete="off" hint={t.payments.referenceHint} error={error} />
            <div className="flex gap-2">
              <Button variant="ghost" size="pill" className="flex-1" disabled={busy} onClick={() => setOpen(false)}>
                {t.common.cancel}
              </Button>
              <Button type="submit" size="pill" className="flex-1" disabled={busy}>
                {busy ? t.player.sending : t.player.sendReference}
              </Button>
            </div>
          </form>
        ) : (
          <div className="border-t border-hairline px-4 py-2">
            <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setOpen(true)}>
              {t.player.addReference}
            </Button>
          </div>
        ))}
    </li>
  );
}
