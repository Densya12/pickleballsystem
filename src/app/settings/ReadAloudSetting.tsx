"use client";

import { useSyncExternalStore } from "react";
import { Toggle } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import { readTagatawagEnabled, subscribeTagatawagEnabled, writeTagatawagEnabled } from "@/lib/tagatawag/announce";

const noSubscribe = () => () => {};
const hasSpeech = () => typeof window.speechSynthesis !== "undefined" && typeof window.SpeechSynthesisUtterance !== "undefined";

/** Settings › Read calls aloud (D17): per device, also in a session's More sheet. Hidden without speech. */
export function ReadAloudSetting() {
  const t = useT();
  const supported = useSyncExternalStore(noSubscribe, hasSpeech, () => false);
  const enabled = useSyncExternalStore(subscribeTagatawagEnabled, readTagatawagEnabled, () => true);
  if (!supported) return null;
  return (
    <li className="px-4">
      <Toggle label={t.live.readAloud} description={t.live.readAloudDescription} checked={enabled} onCheckedChange={writeTagatawagEnabled} />
    </li>
  );
}
