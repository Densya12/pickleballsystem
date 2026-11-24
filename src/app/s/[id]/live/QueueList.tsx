"use client";

import { useEffect, useRef, useState } from "react";
import { SaveAsMember } from "@/components/session/SaveAsMember";
import { Button, StatusLabel } from "@/components/ui";
import { ChevronRightIcon, PauseIcon } from "@/components/ui/icons";
import type { QueueEntry } from "@/lib/queue/data";
import { isHeld, type CallRules } from "@/lib/player/state";
import { levelLabel } from "@/lib/queue/players";

type Props = {
  sessionId: string;
  queue: QueueEntry[];
  /** pay_first + fee: unpaid players show "Hold · bayad muna" (BR6). */
  rules: CallRules;
  busy: boolean;
  onPause: (playerId: string) => Promise<boolean>;
  onResume: (playerId: string) => Promise<boolean>;
  onRemove: (playerId: string) => Promise<boolean>;
};

/** "Susunod sa pila" (BR5 order). Tap a name for its actions; no swipe gestures. */
export function QueueList({ sessionId, queue, rules, busy, onPause, onResume, onRemove }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = queue.find((p) => p.id === openId) ?? null;

  if (queue.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-strong px-5 py-4 text-muted">
        Wala pang nakapila. Magdagdag ng walk-in o ipakita ang QR.
      </p>
    );
  }

  return (
    <>
      <ol className="flex flex-col divide-y divide-default overflow-hidden rounded-card border border-default bg-surface shadow-card">
        {queue.map((player) => (
          <li key={player.id}>
            <button
              type="button"
              onClick={() => setOpenId(player.id)}
              className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-subtle focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-focus"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-subtle font-display font-semibold">
                <span className="sr-only">Pang-</span>
                {player.position}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold [overflow-wrap:anywhere]">{player.name}</span>
                <span className="text-sm text-muted">{levelLabel(player.level)}</span>
              </span>
              {isHeld(player, rules) && <StatusLabel kind="hold" className="shrink-0 text-sm" />}
              {player.status === "paused" && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warn px-2.5 py-1 text-sm font-semibold text-warn">
                  <PauseIcon className="size-4" />
                  Naka-pause
                </span>
              )}
              <ChevronRightIcon className="size-5 shrink-0 text-muted" />
            </button>
          </li>
        ))}
      </ol>

      <PlayerSheet
        sessionId={sessionId}
        player={open}
        busy={busy}
        onClose={() => setOpenId(null)}
        onPause={onPause}
        onResume={onResume}
        onRemove={onRemove}
      />
    </>
  );
}

function PlayerSheet({
  sessionId,
  player,
  busy,
  onClose,
  onPause,
  onResume,
  onRemove,
}: {
  sessionId: string;
  player: QueueEntry | null;
  busy: boolean;
  onClose: () => void;
  onPause: (id: string) => Promise<boolean>;
  onResume: (id: string) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (player && !dialog.open) {
      setConfirming(false);
      dialog.showModal?.();
    } else if (!player && dialog.open) {
      dialog.close();
    }
  }, [player]);

  async function run(action: (id: string) => Promise<boolean>) {
    if (!player) return;
    if (await action(player.id)) onClose();
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="player-sheet-title"
      className="fixed inset-x-0 top-auto bottom-0 m-0 mx-auto w-full max-w-app rounded-t-card bg-surface p-0 text-ink shadow-card backdrop:bg-primary/40"
    >
      {player && (
        <div className="flex flex-col gap-3 px-4 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div>
            <h2 id="player-sheet-title" className="text-2xl [overflow-wrap:anywhere]">
              {player.name}
            </h2>
            <p className="text-muted">
              Pang-{player.position} sa pila · {levelLabel(player.level)}
              {player.status === "paused" ? " · Naka-pause" : ""}
            </p>
          </div>

          {confirming ? (
            <div className="flex flex-col gap-2 rounded-control bg-subtle p-4">
              <p className="font-semibold">Alisin si {player.name} sa pila?</p>
              <Button variant="danger-outline" fullWidth disabled={busy} onClick={() => void run(onRemove)}>
                {busy ? "Inaalis…" : "Oo, alisin"}
              </Button>
              <Button variant="secondary" fullWidth disabled={busy} onClick={() => setConfirming(false)}>
                Huwag
              </Button>
            </div>
          ) : (
            <>
              {player.status === "paused" ? (
                <Button size="lg" fullWidth disabled={busy} onClick={() => void run(onResume)}>
                  Ituloy
                </Button>
              ) : (
                <Button size="lg" fullWidth disabled={busy} onClick={() => void run(onPause)}>
                  <PauseIcon />
                  I-pause
                </Button>
              )}
              <SaveAsMember
                key={player.id}
                sessionId={sessionId}
                playerId={player.id}
                playerName={player.name}
                isMember={player.memberId !== null}
              />
              <Button variant="danger-outline" fullWidth disabled={busy} onClick={() => setConfirming(true)}>
                Alisin sa pila
              </Button>
              <Button variant="secondary" fullWidth onClick={onClose}>
                Isara
              </Button>
            </>
          )}
        </div>
      )}
    </dialog>
  );
}
