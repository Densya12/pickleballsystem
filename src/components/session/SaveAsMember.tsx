"use client";

import { useState, useTransition } from "react";
import { saveAsMemberAction } from "@/app/s/[id]/_lib/member-actions";
import { Button, Notice } from "@/components/ui";
import { CheckIcon } from "@/components/ui/icons";
import { useT } from "@/lib/i18n/client";
import { isNetworkError } from "@/lib/outbox/rules";

type Props = { sessionId: string; playerId: string; playerName: string; isMember: boolean };

/**
 * "Save as member": makes a member from the player and links them. If a
 * member with the same name exists, offers to link to them instead of making
 * a duplicate. compact: a small pill for list rows.
 */
export function SaveAsMember({ sessionId, playerId, playerName, isMember, compact = false }: Props & { compact?: boolean }) {
  const t = useT();
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
        setError(t.live.network);
      }
    });
  }

  if (isMember || state.kind === "saved") {
    return (
      <p className="inline-flex items-center gap-1 text-sm font-medium text-success">
        <CheckIcon className="size-4 shrink-0" />
        {t.members.isMember}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <Notice kind="error">{error}</Notice>}
      {state.kind === "exists" ? (
        <div role="group" aria-label={t.members.existsGroup(state.member.name)} className="flex flex-col gap-2 rounded-control bg-info p-3">
          <p className="text-sm font-medium">{t.members.existsQuestion(state.member.name, playerName)}</p>
          <Button size="md" fullWidth disabled={busy} onClick={() => save({ linkTo: state.member.id })}>
            {t.members.link}
          </Button>
          <Button size="md" variant="outline" fullWidth disabled={busy} onClick={() => save({ createNew: true })}>
            {t.members.createNew}
          </Button>
          <Button size="md" variant="ghost" fullWidth disabled={busy} onClick={() => setState({ kind: "idle" })}>
            {t.common.cancel}
          </Button>
        </div>
      ) : compact ? (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => save()} className="self-start">
          {busy ? t.common.saving : t.members.saveAsMember}
        </Button>
      ) : (
        <Button size="md" variant="outline" fullWidth disabled={busy} onClick={() => save()}>
          {busy ? t.common.saving : t.members.saveAsMember}
        </Button>
      )}
    </div>
  );
}
