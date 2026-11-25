/**
 * Tagatawag (D17): the organizer's phone reads each new call aloud, in the
 * device's language (D20).
 * Pure parts (text, voice choice, the queue) are here; the browser glue is
 * createSpeaker() and the session screens' useTagatawag hook.
 */
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";

/** "Court 2: Ana, Ben, Carlo, and Dina." (Taglish: "… at Dina."). Singles: "Court 2: Ana and Ben." */
export function announcementText(courtLabel: string, names: readonly string[], t: Dictionary): string {
  return t.live.announcement(courtLabel, names);
}

/** Slightly slower than normal, so names carry across a court. */
export const SPEECH_RATE = 0.9;

type VoiceLike = { lang: string };

function langOf(voice: VoiceLike): string {
  return voice.lang.toLowerCase().replace("_", "-");
}

/**
 * A voice for the chosen language (D20). Taglish: Filipino (fil-PH, fil, tl),
 * then en-PH. English: en-PH, then any English voice. Otherwise null (the
 * browser's default).
 */
export function pickVoice<V extends VoiceLike>(voices: readonly V[], locale: Locale = "fil"): V | null {
  if (locale === "fil") {
    const filipino = voices.find((v) => /^(fil|tl)(-|$)/.test(langOf(v)));
    if (filipino) return filipino;
    return voices.find((v) => langOf(v) === "en-ph") ?? null;
  }
  return voices.find((v) => langOf(v) === "en-ph") ?? voices.find((v) => /^en(-|$)/.test(langOf(v))) ?? null;
}

/** Speaks one text, then calls done() exactly once. */
export type SpeakFn = (text: string, done: () => void) => void;

/** One announcement at a time, in order: two calls never talk over each other. */
export class AnnouncementQueue {
  private readonly items: string[] = [];
  private busy = false;

  constructor(private readonly speak: SpeakFn) {}

  enqueue(text: string): void {
    this.items.push(text);
    this.pump();
  }

  get pending(): number {
    return this.items.length + (this.busy ? 1 : 0);
  }

  clear(): void {
    this.items.length = 0;
  }

  private pump() {
    if (this.busy) return;
    const text = this.items.shift();
    if (text === undefined) return;
    this.busy = true;
    let finished = false;
    this.speak(text, () => {
      if (finished) return;
      finished = true;
      this.busy = false;
      this.pump();
    });
  }
}

type SynthLike = Pick<SpeechSynthesis, "speak" | "getVoices">;
type UtteranceCtor = new (text: string) => SpeechSynthesisUtterance;

/**
 * Browser speech. If a browser never fires "end" (it happens), the queue moves
 * on after a generous timeout instead of getting stuck.
 */
export function createSpeaker(synth: SynthLike, Utterance: UtteranceCtor, locale: Locale = "fil"): SpeakFn {
  return (text, done) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(fallback);
      done();
    };
    const fallback = setTimeout(finish, 3_000 + text.length * 120);
    try {
      const utterance = new Utterance(text);
      const voice = pickVoice(synth.getVoices(), locale);
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = locale === "fil" ? "fil-PH" : "en-PH";
      }
      utterance.rate = SPEECH_RATE;
      utterance.onend = finish;
      utterance.onerror = finish;
      synth.speak(utterance);
    } catch {
      finish();
    }
  };
}

const STORAGE_KEY = "opq:tagatawag";
const CHANGE_EVENT = "opq:tagatawag-change";

/** Per device; default ON. */
export function readTagatawagEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function writeTagatawagEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // Not remembered (private mode); the toggle still works for this page.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeTagatawagEnabled(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
