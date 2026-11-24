"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { ScreenWakeLock, type WakeLockApi } from "./wakeLock";

const noSubscribe = () => () => {};
const hasWakeLock = () => "wakeLock" in navigator;

/**
 * Keeps the screen on while `wanted` (queued or playing); released otherwise.
 * Returns whether this browser supports it (assumed yes while rendering on the
 * server, so the "keep the screen open" line only appears where it's needed).
 */
export function useScreenWakeLock(wanted: boolean): { supported: boolean } {
  const supported = useSyncExternalStore(noSubscribe, hasWakeLock, () => true);
  const lock = useRef<ScreenWakeLock | null>(null);

  useEffect(() => {
    const api = (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock;
    const instance = new ScreenWakeLock(api, () => document.visibilityState === "visible");
    lock.current = instance;
    const onVisibility = () => instance.handleVisibilityChange();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      instance.dispose();
      lock.current = null;
    };
  }, []);

  useEffect(() => {
    lock.current?.setWanted(wanted);
  }, [wanted]);

  return { supported };
}
