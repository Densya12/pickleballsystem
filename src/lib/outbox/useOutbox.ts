"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { isNetworkError, replayOutbox, type OutboxItem, type OutboxKind, type SendResult } from "./rules";
import { addToOutbox, emptyOutbox, loadOutbox, removeFromOutbox, subscribeOutbox } from "./store";

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export type Perform<R extends SendResult> = (
  action: { kind: OutboxKind; args: OutboxItem["args"]; label: string },
) => Promise<{ queued: true } | { queued: false; result: R }>;

/**
 * NF10 for one session: whether this phone is online, what's waiting, and
 * perform(), which sends now or, without signal, saves to the outbox. Waiting
 * actions are sent in order when the signal returns. Run it on one visible
 * screen at a time (Live, Bayad); hidden screens' effects are paused.
 */
export function useOutbox<R extends SendResult>(sessionId: string, send: (item: OutboxItem) => Promise<R>) {
  const router = useRouter();
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const items = useSyncExternalStore(subscribeOutbox, () => loadOutbox(sessionId), emptyOutbox);
  const [failed, setFailed] = useState<{ item: OutboxItem; message: string } | null>(null);
  const replaying = useRef(false);

  function enqueue(action: { kind: OutboxKind; args: OutboxItem["args"]; label: string }) {
    addToOutbox({ id: crypto.randomUUID(), sessionId, createdAt: Date.now(), ...action });
  }

  const perform: Perform<R> = async (action) => {
    // Something is already waiting: keep the order, queue behind it.
    if (!navigator.onLine || loadOutbox(sessionId).length > 0) {
      enqueue(action);
      return { queued: true };
    }
    try {
      return { queued: false, result: await send({ id: "", sessionId, createdAt: 0, ...action }) };
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      enqueue(action);
      return { queued: true };
    }
  };

  useEffect(() => {
    if (!online || items.length === 0 || failed || replaying.current) return;
    replaying.current = true;
    const run = async () => {
      const outcome = await replayOutbox(loadOutbox(sessionId), send, (item) => removeFromOutbox(sessionId, item.id));
      if (outcome.status === "failed") setFailed({ item: outcome.item, message: outcome.message });
      if (outcome.sent > 0) router.refresh();
    };
    // One phone may have Live open in two tabs: only one sends.
    const locks = (navigator as Navigator & { locks?: LockManager }).locks;
    const done = locks ? locks.request(`opq-outbox-${sessionId}`, run) : run();
    void Promise.resolve(done).finally(() => {
      replaying.current = false;
    });
  }, [online, items, failed, sessionId, send, router]);

  /** "Itapon": drop the action that failed and send the rest. */
  function discardFailed() {
    if (!failed) return;
    removeFromOutbox(sessionId, failed.item.id);
    setFailed(null);
  }

  return { online, pending: items, failed, perform, enqueue, discardFailed };
}
