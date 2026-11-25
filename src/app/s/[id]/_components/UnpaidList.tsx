"use client";

import { useState } from "react";
import { IconButton, ListGroup, Notice } from "@/components/ui";
import { BellIcon } from "@/components/ui/icons";
import { useT } from "@/lib/i18n/client";
import { reminderMessage } from "@/lib/payments/messages";
import { sendReminder } from "@/lib/payments/remind";

type Props = {
  players: { id: string; name: string }[];
  session: { name: string; fee: number; gcashName: string | null; gcashNumber: string | null };
};

/** Summary: who still owes, each with a Remind button (the reminder message). */
export function UnpaidList({ players, session }: Props) {
  const t = useT();
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  async function remind(name: string) {
    setMessage(null);
    const outcome = await sendReminder(
      name,
      reminderMessage({ name, session: session.name, fee: session.fee, gcashName: session.gcashName, gcashNumber: session.gcashNumber }, t),
      t,
    );
    if (outcome.banner) setMessage({ kind: "success", text: outcome.banner });
    if (outcome.error) setMessage({ kind: "error", text: outcome.error });
  }

  return (
    <div className="flex flex-col gap-2">
      <div aria-live="polite" className="empty:hidden">
        {message && <Notice kind={message.kind}>{message.text}</Notice>}
      </div>
      <ListGroup>
        {players.map((player) => (
          <li key={player.id} aria-label={player.name} className="flex items-center gap-3 px-4 py-3">
            <span className="min-w-0 flex-1 font-medium [overflow-wrap:anywhere]">{player.name}</span>
            <IconButton label={t.payments.remind(player.name)} look="outline" size="sm" onClick={() => void remind(player.name)}>
              <BellIcon className="size-4" />
            </IconButton>
          </li>
        ))}
      </ListGroup>
    </div>
  );
}
