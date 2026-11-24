/** "May puna o problema?" Shown only when NEXT_PUBLIC_FEEDBACK_URL is set (an http(s) link). */
export function FeedbackLink({ className }: { className?: string }) {
  const url = process.env.NEXT_PUBLIC_FEEDBACK_URL;
  if (!url || !/^https?:\/\//i.test(url)) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex min-h-12 items-center justify-center rounded-control px-3 text-center font-semibold underline underline-offset-2 focus-visible:outline-3 focus-visible:outline-focus print:hidden ${className ?? ""}`}
    >
      May puna o problema? Sabihin sa amin
    </a>
  );
}
