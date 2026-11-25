"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";

/** A small "Copy" text button with visible feedback; explains how to copy by hand if blocked. */
export function CopyButton({ text, label, className }: { text: string; label?: string; className?: string }) {
  const t = useT();
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void copy()}
        className="touch-target min-h-8 rounded-control px-2 text-sm font-semibold text-ink hover:bg-surface"
      >
        {state === "copied" ? t.common.copied : (label ?? t.common.copy)}
      </button>
      {state === "failed" && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {t.common.copyFailed}
        </p>
      )}
    </div>
  );
}
