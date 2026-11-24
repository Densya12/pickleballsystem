"use client";

import { useState, useTransition } from "react";
import { Button, Card, Notice } from "@/components/ui";
import { CheckIcon } from "@/components/ui/icons";
import { isNetworkError, NETWORK_ERROR_MESSAGE } from "@/lib/outbox/rules";
import {
  createInviteAction,
  removeStaffAction,
  revokeInviteAction,
  type StaffActionResult,
} from "./actions";
import type { InviteItem, StaffItem } from "./SettingsView";

type Props = { isOwner: boolean; staff: StaffItem[]; invites: InviteItem[] };

export function StaffSection({ isOwner, staff, invites }: Props) {
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
        setError(NETWORK_ERROR_MESSAGE);
      }
    });
  }

  async function copy(invite: InviteItem) {
    try {
      await navigator.clipboard.writeText(invite.url);
      setCopiedId(invite.id);
    } catch {
      setError("Hindi makopya. Pindutin nang matagal ang link para kopyahin.");
    }
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="staff-heading">
      <h2 id="staff-heading" className="text-2xl">
        Mga organizer
      </h2>

      {error && <Notice kind="error">{error}</Notice>}

      <Card padding="none" className="flex flex-col divide-y divide-default">
        {staff.map((member) => {
          const label = member.name ?? member.email ?? "Organizer";
          const confirming = confirmingId === member.userId;
          return (
            <div key={member.userId} className="flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold [overflow-wrap:anywhere]">
                    {label}
                    {member.isMe && <span className="font-normal text-muted"> (Ikaw)</span>}
                  </p>
                  {member.name && member.email && (
                    <p className="text-muted break-all">{member.email}</p>
                  )}
                </div>
                <span className="shrink-0 rounded-full bg-subtle px-3 py-1 text-sm font-semibold">
                  {member.role === "owner" ? "Owner" : "Organizer"}
                </span>
              </div>

              {isOwner && !member.isMe && !confirming && (
                <Button
                  variant="danger-outline"
                  fullWidth
                  disabled={busy}
                  onClick={() => setConfirmingId(member.userId)}
                >
                  Alisin
                </Button>
              )}

              {confirming && (
                <div className="flex flex-col gap-2 rounded-control bg-subtle p-4">
                  <p className="font-semibold">Alisin si {label} sa club?</p>
                  <Button
                    variant="danger-outline"
                    fullWidth
                    disabled={busy}
                    onClick={() =>
                      run(() => removeStaffAction(member.userId), () => setConfirmingId(null))
                    }
                  >
                    {busy ? "Inaalis…" : "Oo, alisin"}
                  </Button>
                  <Button variant="secondary" fullWidth onClick={() => setConfirmingId(null)}>
                    Huwag
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </Card>

      {isOwner && (
        <>
          {invites.map((invite) => (
            <Card key={invite.id} className="flex flex-col gap-3">
              <p className="font-semibold">Invite link</p>
              <p className="rounded-control bg-subtle px-4 py-3 break-all">{invite.url}</p>
              <p className="text-muted">{invite.expiryText}</p>
              <Button variant="secondary" fullWidth onClick={() => void copy(invite)}>
                {copiedId === invite.id ? (
                  <>
                    <CheckIcon />
                    Nakopya na
                  </>
                ) : (
                  "Kopyahin"
                )}
              </Button>
              <Button
                variant="danger-outline"
                fullWidth
                disabled={busy}
                onClick={() => run(() => revokeInviteAction(invite.id))}
              >
                Bawiin ang link
              </Button>
            </Card>
          ))}
          <p className="sr-only" role="status">
            {copiedId ? "Nakopya na ang invite link." : ""}
          </p>
          <Button
            variant="secondary"
            fullWidth
            disabled={busy}
            onClick={() => run(createInviteAction)}
          >
            {busy ? "Sandali…" : "Gumawa ng invite link"}
          </Button>
          <p className="text-muted">
            Ipadala ang link sa co-organizer. Isang beses lang ito magagamit.
          </p>
        </>
      )}
    </section>
  );
}
