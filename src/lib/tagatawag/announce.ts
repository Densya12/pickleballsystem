/**
 * Tagatawag (D17): the organizer's phone reads each new call aloud.
 * Pure parts (text, voice choice, the queue) are here; the browser glue is
 * createSpeaker() and the Live screen's useTagatawag hook.
 */

/** "Court 2: Ana, Ben, Carlo, at Dina."  Singles: "Court 2: Ana at Ben." */
export function announcementText(courtLabel: string, names: readonly string[]): string {
  if (names.length === 0) return `${courtLabel}.`;
  if (names.length === 1) return `${courtLabel}: ${names[0]}.`;
  if (names.length === 2) return `${courtLabel}: ${names[0]} at ${names[1]}.`;
  return `${courtLabel}: ${names.slice(0, -1).join(", ")}, at ${names[names.length - 1]}.`;
}

/** Slightly slower than normal, so names carry across a court. */
export const SPEECH_RATE = 0.9;

type VoiceLike = { lang: string };

function langOf(voice: VoiceLike): string {
  return voice.lang.toLowerCase().replace("_", "-");
}

/** A Filipino voice (fil-PH, fil, tl), then en-PH, then null (the browser's default). */
export function pickVoice<V extends VoiceLike>(voices: readonly V[]): V | null {
  const filipino = voices.find((v) => /^(fil|tl)(-|$)/.test(langOf(v)));
  if (filipino) return filipino;
  return voices.find((v) => langOf(v) === "en-ph") ?? null;
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
export function createSpeaker(synth: SynthLike, Utterance: UtteranceCtor): SpeakFn {
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
      const voice = pickVoice(synth.getVoices());
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = "fil-PH";
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
