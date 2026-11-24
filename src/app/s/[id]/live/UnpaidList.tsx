"use client";

import { useState } from "react";
import { Button, Notice } from "@/components/ui";
import { reminderMessage } from "@/lib/payments/messages";
import { sendReminder } from "@/lib/payments/remind";

type Props = {
  players: { id: string; name: string }[];
  session: { name: string; fee: number; gcashName: string | null; gcashNumber: string | null };
};

/** Buod: who still owes, each with "Paalalahanan" (the Phase 5 message). */
export function UnpaidList({ players, session }: Props) {
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  async function remind(name: string) {
    setMessage(null);
    const outcome = await sendReminder(
      name,
      reminderMessage({ name, session: session.name, fee: session.fee, gcashName: session.gcashName, gcashNumber: session.gcashNumber }),
    );
    if (outcome.banner) setMessage({ kind: "success", text: outcome.banner });
    if (outcome.error) setMessage({ kind: "error", text: outcome.error });
  }

  return (
    <div className="flex flex-col gap-3">
      <div aria-live="polite">{message && <Notice kind={message.kind}>{message.text}</Notice>}</div>
      <ul className="flex flex-col divide-y divide-default rounded-card border border-default bg-surface">
        {players.map((player) => (
          <li key={player.id} className="flex flex-col gap-2 px-4 py-3" aria-label={player.name}>
            <span className="font-semibold [overflow-wrap:anywhere]">{player.name}</span>
            <Button variant="secondary" fullWidth onClick={() => void remind(player.name)}>
              Paalalahanan
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
