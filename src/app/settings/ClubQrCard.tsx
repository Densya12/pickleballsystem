"use client";

import { useState, useTransition } from "react";
import { Button, Card, Notice } from "@/components/ui";
import { PrinterIcon, QrIcon } from "@/components/ui/icons";
import { isNetworkError, NETWORK_ERROR_MESSAGE } from "@/lib/outbox/rules";
import { regenerateEntryCodeAction } from "./actions";

export type ClubQr = { url: string; svg: string; clubName: string };

/**
 * The club's permanent QR (D18): print it once, and players scan it every
 * week. When printing, only this card's QR, the club name and "I-scan para
 * pumila" show (the rest of Settings is print:hidden).
 */
export function ClubQrCard({ qr }: { qr: ClubQr }) {
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [busy, startTransition] = useTransition();

  function regenerate() {
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof regenerateEntryCodeAction>>;
      try {
        result = await regenerateEntryCodeAction();
      } catch (caught) {
        if (!isNetworkError(caught)) throw caught;
        result = { error: NETWORK_ERROR_MESSAGE };
      }
      setConfirming(false);
      setMessage(
        result.error
          ? { kind: "error", text: result.error }
          : { kind: "success", text: "Napalitan na ang QR. I-print ang bago." },
      );
    });
  }

  return (
    <section aria-labelledby="club-qr-heading" className="flex flex-col gap-3 print:pt-8">
      <h2 id="club-qr-heading" className="text-2xl print:hidden">
        QR ng club
      </h2>
      <Card className="flex flex-col gap-4 print:items-center print:border-0 print:shadow-none">
        <p className="hidden text-center font-display text-5xl font-semibold break-words print:block">{qr.clubName}</p>
        <p className="text-muted print:hidden">
          Iisang QR para sa lahat ng session. Kapag may live na session, dito na sila pipila.
        </p>
        <div
          role="img"
          aria-label={`QR code ng club: ${qr.url}`}
          className="mx-auto w-full max-w-56 print:max-w-[12cm] [&_svg]:h-auto [&_svg]:w-full"
          dangerouslySetInnerHTML={{ __html: qr.svg }}
        />
        <p className="hidden text-center text-4xl font-semibold print:block">I-scan para pumila</p>
        <div className="flex flex-col gap-1 rounded-control bg-subtle px-4 py-3 print:hidden">
          <p className="text-muted">Link ng QR:</p>
          <p className="font-semibold break-all">{qr.url}</p>
        </div>

        <div className="flex flex-col gap-3 print:hidden" aria-live="polite">
          {message && <Notice kind={message.kind}>{message.text}</Notice>}
          <Button fullWidth onClick={() => window.print()}>
            <PrinterIcon />
            I-print ang QR
          </Button>
          {confirming ? (
            <div
              role="group"
              aria-label="Palitan ang QR?"
              className="flex flex-col gap-2 rounded-control border-[1.5px] border-ink bg-surface p-4"
            >
              <p className="font-semibold">Palitan ang QR?</p>
              <p>Hindi na gagana ang mga naka-print na QR. Kailangang i-print ulit.</p>
              <Button variant="danger-outline" fullWidth disabled={busy} onClick={regenerate}>
                {busy ? "Pinapalitan…" : "Oo, palitan"}
              </Button>
              <Button variant="secondary" fullWidth disabled={busy} onClick={() => setConfirming(false)}>
                Huwag
              </Button>
            </div>
          ) : (
            <Button variant="secondary" fullWidth onClick={() => { setMessage(null); setConfirming(true); }}>
              <QrIcon />
              Palitan ang QR
            </Button>
          )}
        </div>
      </Card>
    </section>
  );
}
