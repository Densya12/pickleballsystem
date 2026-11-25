"use client";

import { useTransition } from "react";
import { setLocaleAction } from "@/lib/i18n/actions";
import { useLocale, useT } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/locale";
import { cn } from "@/lib/cn";

/**
 * Language choice, saved per device (D20). "compact" is the players' EN | TL
 * switch (top right); "full" is Settings › Language (English | Taglish).
 */
export function LanguageSwitch({ look = "compact", label }: { look?: "compact" | "full"; label?: string }) {
  const t = useT();
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const options: { value: Locale; short: string; long: string }[] = [
    { value: "en", short: "EN", long: t.settings.english },
    { value: "fil", short: "TL", long: t.settings.taglish },
  ];

  function choose(next: Locale) {
    if (next === locale || pending) return;
    startTransition(() => setLocaleAction(next));
  }

  return (
    <div
      role="radiogroup"
      aria-label={label ?? t.player.languageSwitch}
      className={cn("flex rounded-control bg-subtle p-[3px]", look === "compact" ? "w-auto" : "w-full")}
    >
      {options.map((option) => {
        const checked = option.value === locale;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.long}
            onClick={() => choose(option.value)}
            className={cn(
              "touch-target flex flex-1 items-center justify-center rounded-[10px] font-medium",
              look === "compact" ? "h-8 min-w-10 px-2.5 text-xs" : "h-[34px] text-sm",
              checked ? "bg-surface text-ink shadow-[0_1px_2px_rgba(17,20,18,0.08)]" : "text-secondary",
            )}
          >
            {look === "compact" ? option.short : option.long}
          </button>
        );
      })}
    </div>
  );
}
