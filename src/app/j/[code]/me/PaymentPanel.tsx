"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, CopyButton, Input } from "@/components/ui";
import { AlertIcon, CheckIcon, ClockIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { formatGcashNumber, formatPeso } from "@/lib/format";
import { paymentStatusText } from "@/lib/payments/messages";
import { normalizeReference, REFERENCE_MESSAGES } from "@/lib/payments/reference";
import { playerErrorMessage } from "@/lib/player/messages";
import { createClient } from "@/lib/supabase/client";

type Props = {
  playerId: string;
  fee: number;
  payFirst: boolean;
  gcash: { name: string | null; number: string | null };
  payment: { status: string; method: string | null };
};

const STYLE = {
  confirmed: { Icon: CheckIcon, className: "bg-success text-success" },
  pending: { Icon: ClockIcon, className: "bg-subtle text-ink" },
  unpaid: { Icon: AlertIcon, className: "bg-warn text-warn" },
} as const;

/** Pwesto: payment status, and a way to send a GCash reference while unpaid (BR13). */
export function PaymentPanel({ playerId, fee, payFirst, gcash, payment }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  if (fee <= 0) return null;

  const status = (payment.status in STYLE ? payment.status : "unpaid") as keyof typeof STYLE;
  const { Icon, className } = STYLE[status];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = String(new FormData(event.currentTarget).get("reference") ?? "");
    if (!normalizeReference(raw)) {
      setError(REFERENCE_MESSAGES.invalid);
      return;
    }
    setBusy(true);
    const { error: rpcError } = await createClient().rpc("player_submit_reference", { p_player_id: playerId, p_reference: raw });
    setBusy(false);
    if (rpcError) {
      setError(playerErrorMessage(rpcError));
      return;
    }
    setOpen(false);
    setError(undefined);
    router.refresh();
  }

  return (
    <section aria-label="Bayad" className="flex flex-col gap-3">
      <p className={cn("flex items-start gap-2 rounded-control px-4 py-3 font-semibold", className)} data-payment={status}>
        <Icon className="mt-0.5 size-5 shrink-0" />
        <span>
          {paymentStatusText(status)} · {formatPeso(fee)}
          {status === "unpaid" && payment.method === "cash" && (
            <span className="block font-normal">Cash: ibigay sa organizer.</span>
          )}
        </span>
      </p>
      {status === "unpaid" && payFirst && <p className="font-semibold">Nilalaktawan ka muna hangga&apos;t hindi bayad.</p>}
      {status === "unpaid" &&
        (open ? (
          <form onSubmit={submit} noValidate className="flex flex-col gap-3 rounded-control border-[1.5px] border-ink bg-surface p-4">
            {gcash.number && (
              <div className="flex flex-col gap-2">
                <p className="text-muted">I-send sa GCash ng club:</p>
                <p className="font-semibold [overflow-wrap:anywhere]">
                  {gcash.name ? `${gcash.name} · ` : ""}
                  {formatGcashNumber(gcash.number)}
                </p>
                <CopyButton text={gcash.number} label="Kopyahin ang number" />
              </div>
            )}
            <Input label="GCash reference number" name="reference" inputMode="numeric" autoComplete="off" hint={REFERENCE_MESSAGES.hint} error={error} />
            <Button type="submit" fullWidth disabled={busy}>
              {busy ? "Ipinapadala…" : "I-submit ang reference"}
            </Button>
            <Button variant="secondary" fullWidth disabled={busy} onClick={() => setOpen(false)}>
              Huwag muna
            </Button>
          </form>
        ) : (
          <Button variant="secondary" fullWidth onClick={() => setOpen(true)}>
            Ilagay ang GCash reference
          </Button>
        ))}
    </section>
  );
}
