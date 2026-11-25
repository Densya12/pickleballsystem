"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { dictionaries, type Dictionary } from "./dictionary";
import { DEFAULT_LOCALE, type Locale } from "./locale";

const I18nContext = createContext<{ locale: Locale; t: Dictionary }>({
  locale: DEFAULT_LOCALE,
  t: dictionaries[DEFAULT_LOCALE],
});

/** Wraps the app (see LocaleRoot); client components read it with useT(). */
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  // Keep <html lang> in step after a switch (the inline script handles the first paint).
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return <I18nContext.Provider value={{ locale, t: dictionaries[locale] }}>{children}</I18nContext.Provider>;
}

export function useT(): Dictionary {
  return useContext(I18nContext).t;
}

export function useLocale(): Locale {
  return useContext(I18nContext).locale;
}
