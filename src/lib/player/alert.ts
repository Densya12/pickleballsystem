/**
 * "Ikaw na!" alert: a short chime and a vibration where the browser allows.
 * Browsers only play sound after a tap, so unlockAudio() runs on "Pumila na"
 * (and on any tap on the Pwesto screen, e.g. after a reload). iPhone has no
 * navigator.vibrate; that part is skipped silently. Stronger alerts: Phase 6.
 */

type WindowWithWebkit = Window & { webkitAudioContext?: typeof AudioContext };

let context: AudioContext | null = null;

export function unlockAudio(): void {
  try {
    const Ctor = window.AudioContext ?? (window as WindowWithWebkit).webkitAudioContext;
    if (!Ctor) return;
    context ??= new Ctor();
    if (context.state === "suspended") void context.resume();
    // A silent buffer, played inside the tap, keeps iOS Safari's audio unlocked.
    const source = context.createBufferSource();
    source.buffer = context.createBuffer(1, 1, 22_050);
    source.connect(context.destination);
    source.start(0);
  } catch {
    // No audio: the on-screen "Ikaw na" is still shown.
  }
}

function tone(ctx: AudioContext, frequency: number, start: number, length: number) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.4, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + length + 0.05);
}

export function playCalledAlert(): void {
  try {
    if (context && context.state === "running") {
      const now = context.currentTime;
      tone(context, 880, now, 0.18);
      tone(context, 1320, now + 0.22, 0.28);
    }
  } catch {
    // ignore
  }
  try {
    navigator.vibrate?.([250, 120, 250]);
  } catch {
    // ignore (not available on iPhone)
  }
}
