"use client";

import { useState } from "react";
import { Button } from "./Button";
import { CheckIcon } from "./icons";

/** Copies text with visible feedback ("Nakopya na"); explains how to copy by hand if blocked. */
export function CopyButton({ text, label, className }: { text: string; label: string; className?: string }) {
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
      <Button variant="secondary" fullWidth onClick={() => void copy()}>
        {state === "copied" ? (
          <>
            <CheckIcon />
            Nakopya na
          </>
        ) : (
          label
        )}
      </Button>
      {state === "failed" && (
        <p role="alert" className="mt-1.5 text-base text-danger">
          Hindi makopya. Pindutin nang matagal ang number para kopyahin.
        </p>
      )}
    </div>
  );
}
