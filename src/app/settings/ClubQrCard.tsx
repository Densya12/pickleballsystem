"use client";

import { useState, useTransition } from "react";
import { Button, Notice } from "@/components/ui";
import { PrinterIcon } from "@/components/ui/icons";
import { useT } from "@/lib/i18n/client";
import { isNetworkError } from "@/lib/outbox/rules";
import { regenerateEntryCodeAction } from "./actions";

export type ClubQr = { url: string; svg: string; clubName: string };

/**
 * The club's permanent QR (D18): print it once, and players scan it every
 * week. When printing, only the QR, the club name and "Scan to join" show.
 */
export function ClubQrCard({ qr }: { qr: ClubQr }) {
  const t = useT();
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
        result = { error: t.live.network };
      }
      setConfirming(false);
      setMessage(result.error ? { kind: "error", text: result.error } : { kind: "success", text: t.settings.replaced });
    });
  }

  return (
    <section aria-label={t.settings.clubQr} className="flex flex-col gap-3 print:pt-8">
      <div className="flex flex-col items-center gap-3 rounded-card bg-surface p-5 print:shadow-none">
        <p className="hidden text-center font-display text-display-court font-semibold break-words print:block">{qr.clubName}</p>
        <p className="text-sm text-muted print:hidden">{t.settings.clubQrIntro}</p>
        <div
          role="img"
          aria-label={t.settings.clubQrAlt(qr.url)}
          className="w-full max-w-56 print:max-w-[12cm] [&_svg]:h-auto [&_svg]:w-full"
          dangerouslySetInnerHTML={{ __html: qr.svg }}
        />
        <p className="hidden text-center text-3xl font-semibold print:block">{t.settings.printTitle}</p>
      </div>
      <div className="rounded-group bg-surface px-4 py-3 print:hidden">
        <p className="text-sm text-muted">{t.settings.qrLink}</p>
        <p className="font-medium break-all">{qr.url}</p>
      </div>

      <div className="flex flex-col gap-2 print:hidden" aria-live="polite">
        {message && <Notice kind={message.kind}>{message.text}</Notice>}
        <Button size="lg" fullWidth onClick={() => window.print()}>
          <PrinterIcon className="size-[18px]" />
          {t.settings.printQr}
        </Button>
        {confirming ? (
          <div role="group" aria-label={t.settings.replaceQuestion} className="flex flex-col gap-2 rounded-group bg-surface p-4">
            <p className="font-medium">{t.settings.replaceQuestion}</p>
            <p className="text-sm text-muted">{t.settings.replaceWarning}</p>
            <Button variant="danger-outline" size="md" fullWidth disabled={busy} onClick={regenerate}>
              {busy ? t.settings.replacing : t.settings.yesReplace}
            </Button>
            <Button variant="ghost" size="md" fullWidth disabled={busy} onClick={() => setConfirming(false)}>
              {t.common.cancel}
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="md"
            fullWidth
            onClick={() => {
              setMessage(null);
              setConfirming(true);
            }}
          >
            {t.settings.replaceQr}
          </Button>
        )}
      </div>
    </section>
  );
}
