"use client";

import { useState } from "react";
import { Button, Notice } from "@/components/ui";
import { PrinterIcon, ShareIcon } from "@/components/ui/icons";

/** "I-share sa Messenger" uses the phone's share sheet; without it, copies the link. */
export function ShareActions({ url, sessionName }: { url: string; sessionName: string }) {
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  async function share() {
    setMessage(null);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: sessionName, text: `Pumila sa ${sessionName}:`, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setMessage({ kind: "success", text: "Nakopya ang link. I-paste sa Messenger." });
    } catch {
      setMessage({ kind: "error", text: "Hindi makopya. Pindutin nang matagal ang link sa itaas para kopyahin." });
    }
  }

  return (
    <div className="flex flex-col gap-3 print:hidden">
      {message && <Notice kind={message.kind}>{message.text}</Notice>}
      <Button size="lg" fullWidth onClick={() => void share()}>
        <ShareIcon />
        I-share sa Messenger
      </Button>
      <Button variant="secondary" fullWidth onClick={() => window.print()}>
        <PrinterIcon />
        I-print ang QR
      </Button>
    </div>
  );
}
