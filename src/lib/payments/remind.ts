/**
 * "Paalalahanan": share the reminder (the phone's share sheet), or copy it
 * where there is none. Used on Bayad and on the session summary.
 */
export type RemindOutcome = { kind: "shared" | "copied" | "cancelled" | "failed"; banner?: string; error?: string };

export async function sendReminder(name: string, text: string): Promise<RemindOutcome> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ text });
      return { kind: "shared", banner: `Naipadala ang paalala para kay ${name}.` };
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") return { kind: "cancelled" };
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return { kind: "copied", banner: `Nakopya ang paalala para kay ${name}. I-paste sa Messenger.` };
  } catch {
    return { kind: "failed", error: "Hindi makopya ang paalala. Subukan ulit." };
  }
}
