"use client";

import { useState, useTransition } from "react";
import { saveAsMemberAction } from "@/app/s/[id]/member-actions";
import { Button, Notice } from "@/components/ui";
import { CheckIcon } from "@/components/ui/icons";
import { isNetworkError, NETWORK_ERROR_MESSAGE } from "@/lib/outbox/rules";

type Props = { sessionId: string; playerId: string; playerName: string; isMember: boolean };

/**
 * "I-save bilang member": makes a member from the player and links them. If a
 * member with the same name exists, offers to link to them instead of making a
 * duplicate.
 */
export function SaveAsMember({ sessionId, playerId, playerName, isMember }: Props) {
  const [state, setState] = useState<
    { kind: "idle" } | { kind: "exists"; member: { id: string; name: string } } | { kind: "saved"; name: string }
  >({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  function save(choice: { linkTo?: string; createNew?: boolean } = {}) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await saveAsMemberAction(sessionId, playerId, choice);
        if (result.status === "saved") setState({ kind: "saved", name: result.memberName });
        else if (result.status === "exists") setState({ kind: "exists", member: result.member });
        else setError(result.error);
      } catch (caught) {
        if (!isNetworkError(caught)) throw caught;
        setError(NETWORK_ERROR_MESSAGE);
      }
    });
  }

  if (isMember || state.kind === "saved") {
    return (
      <p className="inline-flex items-center gap-1.5 font-semibold text-success">
        <CheckIcon className="size-5 shrink-0" />
        Member na
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <Notice kind="error">{error}</Notice>}
      {state.kind === "exists" ? (
        <div role="group" aria-label={`May member na na ${state.member.name}`} className="flex flex-col gap-2 rounded-control border-[1.5px] border-ink bg-surface p-4">
          <p className="font-semibold">May member na na {state.member.name}. I-link si {playerName} sa kanya?</p>
          <Button fullWidth disabled={busy} onClick={() => save({ linkTo: state.member.id })}>
            I-link sa kanya
          </Button>
          <Button variant="secondary" fullWidth disabled={busy} onClick={() => save({ createNew: true })}>
            Gumawa ng bagong member
          </Button>
          <Button variant="secondary" fullWidth disabled={busy} onClick={() => setState({ kind: "idle" })}>
            Huwag
          </Button>
        </div>
      ) : (
        <Button variant="secondary" fullWidth disabled={busy} onClick={() => save()}>
          {busy ? "Sine-save…" : "I-save bilang member"}
        </Button>
      )}
    </div>
  );
}
