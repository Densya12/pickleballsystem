"use client";

import { useState } from "react";
import { Button, Notice } from "@/components/ui";
import { PrinterIcon, ShareIcon } from "@/components/ui/icons";
import { useT } from "@/lib/i18n/client";

/** "Share link" uses the phone's share sheet; without it, copies the link. */
export function ShareActions({ url, sessionName }: { url: string; sessionName: string }) {
  const t = useT();
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  async function share() {
    setMessage(null);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: sessionName, text: t.live.shareText(sessionName), url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setMessage({ kind: "success", text: t.live.linkCopied });
    } catch {
      setMessage({ kind: "error", text: t.live.linkCopyFailed });
    }
  }

  return (
    <div className="flex flex-col gap-2 print:hidden">
      {message && <Notice kind={message.kind}>{message.text}</Notice>}
      <Button size="lg" fullWidth onClick={() => void share()}>
        <ShareIcon className="size-[18px]" />
        {t.live.share}
      </Button>
      <Button variant="ghost" size="md" fullWidth onClick={() => window.print()}>
        <PrinterIcon className="size-4" />
        {t.live.print}
      </Button>
    </div>
  );
}
