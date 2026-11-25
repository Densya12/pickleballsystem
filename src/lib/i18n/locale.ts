/**
 * Language (D20). English is the default; Taglish ("fil") is the second
 * language. The choice lives in a cookie per device, so server components
 * render in the right language.
 */
export const LOCALES = ["en", "fil"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "opq-lang";
/** One year. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** For Intl date/number formatting (both use the Philippine conventions). */
export function intlLocale(locale: Locale): string {
  return locale === "fil" ? "fil-PH" : "en-PH";
}

/**
 * Sets <html lang> from the cookie before the first paint. The root layout
 * stays static (reading the cookie there would make every page wait), so this
 * small script corrects the attribute; React keeps it (suppressHydrationWarning).
 */
export const HTML_LANG_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${LOCALE_COOKIE}=([^;]+)/);document.documentElement.lang=m&&m[1]==="fil"?"fil":"en"}catch(e){}})()`;
