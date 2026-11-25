"use client";

import Link from "next/link";
import "./globals.css";
import { dictionaries } from "@/lib/i18n/dictionary";
import { HTML_LANG_SCRIPT, LOCALE_COOKIE } from "@/lib/i18n/locale";

/** When even the app's frame fails: a minimal page of its own (it replaces the root layout). */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // No provider here: read the language cookie directly.
  const locale = typeof document !== "undefined" && new RegExp(`${LOCALE_COOKIE}=fil`).test(document.cookie) ? "fil" : "en";
  const t = dictionaries[locale];
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: HTML_LANG_SCRIPT }} />
      </head>
      <body className="bg-page text-ink">
        <main className="mx-auto flex min-h-dvh w-full max-w-app flex-col gap-4 px-4 pt-16">
          <h1 className="title-large">{t.system.errorTitle}</h1>
          <button type="button" onClick={() => reset()} className="min-h-[52px] rounded-button bg-primary px-6 font-semibold text-on-primary">
            {t.common.retry}
          </button>
          <Link href="/" className="min-h-11 py-3 font-medium underline underline-offset-2">
            {t.system.backHome}
          </Link>
        </main>
      </body>
    </html>
  );
}
