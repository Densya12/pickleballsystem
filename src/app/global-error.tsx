"use client";

import Link from "next/link";
import "./globals.css";

/** When even the app's frame fails: a minimal page of its own (it replaces the root layout). */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fil">
      <body className="bg-page text-ink">
        <main className="mx-auto flex min-h-dvh w-full max-w-app flex-col gap-4 px-4 pt-16">
          <h1 className="text-3xl">May nagkaproblema. Subukan ulit.</h1>
          <button
            type="button"
            onClick={() => reset()}
            className="min-h-14 rounded-control bg-primary px-6 text-lg font-semibold text-on-primary"
          >
            Subukan ulit
          </button>
          <Link href="/" className="min-h-12 py-3 font-semibold underline underline-offset-2">
            Bumalik sa home
          </Link>
        </main>
      </body>
    </html>
  );
}
