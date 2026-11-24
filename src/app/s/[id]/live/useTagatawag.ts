"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import type { LiveCourt } from "@/lib/queue/data";
import type { SyncStatus } from "@/lib/realtime/useSessionSync";
import {
  AnnouncementQueue,
  announcementText,
  createSpeaker,
  readTagatawagEnabled,
  subscribeTagatawagEnabled,
  writeTagatawagEnabled,
} from "@/lib/tagatawag/announce";
import { takeNewCalls, type CourtCall } from "@/lib/tagatawag/newCalls";

const noSubscribe = () => () => {};
const hasSpeech = () => typeof window.speechSynthesis !== "undefined" && typeof window.SpeechSynthesisUtterance !== "undefined";

/** After a reconnect, the refetch brings games that started meanwhile: absorb them silently. */
const RECONNECT_QUIET_MS = 5_000;

/**
 * Tagatawag (D17): reads each new call aloud while the Live screen is open.
 * New games come from any source (call_next, the call after finish_game,
 * swap_not_ready, another organizer's phone), because they are detected in the
 * Live data, not in the actions.
 */
export function useTagatawag(courts: readonly LiveCourt[], sync: SyncStatus) {
  const supported = useSyncExternalStore(noSubscribe, hasSpeech, () => false);
  const enabled = useSyncExternalStore(subscribeTagatawagEnabled, readTagatawagEnabled, () => true);

  const queue = useRef<AnnouncementQueue | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const quietUntil = useRef(0);
  const lastSync = useRef<SyncStatus>(sync);

  // Speech needs a user gesture first: unlock on the organizer's first tap on Live.
  useEffect(() => {
    if (!supported) return;
    const unlock = () => {
      try {
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
      } catch {
        // Not available after all: nothing is read aloud.
      }
      window.removeEventListener("pointerdown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    return () => window.removeEventListener("pointerdown", unlock);
  }, [supported]);

  // Hidden (another page) or closed: forget what was seen, so coming back only remembers.
  useEffect(() => () => {
    seen.current = null;
  }, []);

  useEffect(() => {
    if (lastSync.current === "lost" && sync === "connected") quietUntil.current = Date.now() + RECONNECT_QUIET_MS;
    lastSync.current = sync;
  }, [sync]);

  useEffect(() => {
    const calls = courtCalls(courts);
    if (seen.current === null) {
      seen.current = new Set(calls.map((c) => c.key));
      return;
    }
    // Remembered even while off, so turning it back on doesn't replay them.
    const fresh = takeNewCalls(seen.current, calls);
    if (fresh.length === 0 || !supported || !enabled || Date.now() < quietUntil.current) return;
    queue.current ??= new AnnouncementQueue(createSpeaker(window.speechSynthesis, window.SpeechSynthesisUtterance));
    for (const call of fresh) queue.current.enqueue(call.text);
  }, [courts, supported, enabled]);

  function setEnabled(next: boolean) {
    writeTagatawagEnabled(next);
    if (!next) {
      queue.current?.clear();
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
  }

  return { supported, enabled, setEnabled };
}

function courtCalls(courts: readonly LiveCourt[]): CourtCall[] {
  return courts.flatMap((court) =>
    court.game
      ? [
          {
            key: `${court.game.id}:${court.game.players.map((p) => p.id).join(",")}`,
            courtNumber: court.number,
            text: announcementText(court.label, court.game.players.map((p) => p.name)),
          },
        ]
      : [],
  );
}
