"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { playCalledAlert, unlockAudio } from "./alert";
import { alertStartedAt, startRepeatingAlert } from "./alertRepeat";

const ACK_KEY = (gameId: string) => `opq:ack:${gameId}`;
const ACK_EVENT = "opq:ack-change";

function subscribeToAcks(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(ACK_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(ACK_EVENT, onChange);
  };
}

function readAck(gameId: string): boolean {
  try {
    return window.localStorage.getItem(ACK_KEY(gameId)) === "1";
  } catch {
    return false;
  }
}

/**
 * "Ikaw na!" for the game the player was called to (null when not playing),
 * shared by Pwesto and Mga court. The chime and vibration repeat every 10 s
 * until "Papunta na ako", for at most 1 minute. The tap is remembered per game
 * on this phone, so a reload or the other screen doesn't alert again.
 */
export function useCalledAlert(gameId: string | null): { acked: boolean; acknowledge: () => void } {
  const [ackedHere, setAckedHere] = useState<Record<string, boolean>>({});
  const storedAck = useSyncExternalStore(subscribeToAcks, () => (gameId ? readAck(gameId) : false), () => false);
  const acked = gameId ? (ackedHere[gameId] ?? false) || storedAck : false;

  // A reload loses the audio unlock from "Pumila na"; any tap here restores it.
  useEffect(() => {
    window.addEventListener("pointerdown", unlockAudio);
    return () => window.removeEventListener("pointerdown", unlockAudio);
  }, []);

  useEffect(() => {
    if (!gameId || acked) return;
    return startRepeatingAlert(playCalledAlert, alertStartedAt(gameId, Date.now()));
  }, [gameId, acked]);

  function acknowledge() {
    if (!gameId) return;
    try {
      window.localStorage.setItem(ACK_KEY(gameId), "1");
    } catch {
      // Remembered for this page only.
    }
    setAckedHere((current) => ({ ...current, [gameId]: true }));
    window.dispatchEvent(new Event(ACK_EVENT));
  }

  return { acked, acknowledge };
}
