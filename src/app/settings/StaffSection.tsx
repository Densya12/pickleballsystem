"use client";

import { useState, useTransition } from "react";
import { Button, ListGroup, Notice } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import { isNetworkError } from "@/lib/outbox/rules";
import { createInviteAction, removeStaffAction, revokeInviteAction, type StaffActionResult } from "./actions";

export type StaffItem = { userId: string; role: "owner" | "organizer"; name: string | null; email: string | null; isMe: boolean };
export type InviteItem = { id: string; url: string; expiryText: string };

/** Co-organizers: who runs the club, invites (owner only), removing. */
export function StaffSection({ isOwner, staff, invites }: { isOwner: boolean; staff: StaffItem[]; invites: InviteItem[] }) {
  const t = useT();
  const [error, setError] = useState<string>();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  function run(action: () => Promise<StaffActionResult>, after?: () => void) {
    setError(undefined);
    startTransition(async () => {
      try {
        const result = await action();
        if (result.error) setError(result.error);
        else after?.();
      } catch (caught) {
        if (!isNetworkError(caught)) throw caught;
        setError(t.live.network);
      }
    });
  }

  async function copy(invite: InviteItem) {
    try {
      await navigator.clipboard.writeText(invite.url);
      setCopiedId(invite.id);
    } catch {
      setError(t.common.copyFailed);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <Notice kind="error">{error}</Notice>}
      <ListGroup>
        {staff.map((member) => {
          const label = member.name ?? member.email ?? t.settings.organizer;
          const confirming = confirmingId === member.userId;
          return (
            <li key={member.userId} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium [overflow-wrap:anywhere]">
                    {label}
                    {member.isMe && <span className="font-normal text-muted"> {t.settings.you}</span>}
                  </p>
                  {member.name && member.email && <p className="text-sm break-all text-muted">{member.email}</p>}
                </div>
                <span className="shrink-0 rounded-full bg-chip px-2.5 py-[3px] text-xs font-medium text-secondary">
                  {member.role === "owner" ? t.settings.owner : t.settings.organizer}
                </span>
              </div>
              {isOwner && !member.isMe && !confirming && (
                <Button variant="danger" size="sm" className="self-start" disabled={busy} onClick={() => setConfirmingId(member.userId)}>
                  {t.settings.remove}
                </Button>
              )}
              {confirming && (
                <div className="flex flex-col gap-2 rounded-control bg-info p-3">
                  <p className="text-sm font-medium">{t.settings.removeQuestion(label)}</p>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="pill" className="flex-1" onClick={() => setConfirmingId(null)}>
                      {t.common.cancel}
                    </Button>
                    <Button
                      variant="danger-outline"
                      size="pill"
                      className="flex-1"
                      disabled={busy}
                      onClick={() => run(() => removeStaffAction(member.userId), () => setConfirmingId(null))}
                    >
                      {busy ? t.settings.removing : t.settings.yesRemove}
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ListGroup>

      {isOwner && (
        <>
          {invites.map((invite) => (
            <div key={invite.id} className="flex flex-col gap-2 rounded-group bg-surface p-4">
              <p className="text-sm font-semibold text-muted">{t.settings.inviteLink}</p>
              <p className="break-all">{invite.url}</p>
              <p className="text-sm text-muted">{invite.expiryText}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="pill" className="flex-1" onClick={() => void copy(invite)}>
                  {copiedId === invite.id ? t.common.copied : t.common.copy}
                </Button>
                <Button variant="danger" size="pill" className="flex-1" disabled={busy} onClick={() => run(() => revokeInviteAction(invite.id))}>
                  {t.settings.revoke}
                </Button>
              </div>
            </div>
          ))}
          <p className="sr-only" role="status">
            {copiedId ? t.settings.inviteCopied : ""}
          </p>
          <Button size="lg" fullWidth disabled={busy} onClick={() => run(createInviteAction)}>
            {busy ? t.settings.creatingInvite : t.settings.createInvite}
          </Button>
          <p className="px-1 text-sm text-muted">{t.settings.inviteHint}</p>
        </>
      )}
    </div>
  );
}
