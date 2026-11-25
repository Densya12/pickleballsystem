import { ExternalIcon } from "./icons";

/** The NEXT_PUBLIC_FEEDBACK_URL link, or null when it isn't set (or isn't http(s)). */
export function feedbackUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_FEEDBACK_URL;
  return url && /^https?:\/\//i.test(url) ? url : null;
}

/** "Send feedback" as a list row (Settings, Summary). Hidden when not configured. */
export function FeedbackRow({ label }: { label: string }) {
  const url = feedbackUrl();
  if (!url) return null;
  return (
    <li>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-h-12 items-center gap-3 px-4 py-3 hover:bg-info focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-focus"
      >
        <span className="flex-1">{label}</span>
        <ExternalIcon className="size-4 shrink-0 text-[#9aa09c]" />
      </a>
    </li>
  );
}
