import type { Dictionary } from "@/lib/i18n/dictionary";

/**
 * "Remind": share the reminder (the phone's share sheet), or copy it where
 * there is none. Used on Payments and on the session summary.
 */
export type RemindOutcome = { kind: "shared" | "copied" | "cancelled" | "failed"; banner?: string; error?: string };

export async function sendReminder(name: string, text: string, t: Dictionary): Promise<RemindOutcome> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ text });
      return { kind: "shared", banner: t.payments.reminderSent(name) };
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") return { kind: "cancelled" };
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return { kind: "copied", banner: t.payments.reminderCopied(name) };
  } catch {
    return { kind: "failed", error: t.payments.reminderFailed };
  }
}
