"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, type Locale } from "./locale";

/** Settings › Language, and the players' EN | TL switch. Per device (cookie). */
export async function setLocaleAction(locale: Locale): Promise<void> {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
    // Read by the inline <html lang> script, so not httpOnly. It's only a preference.
    httpOnly: false,
  });
  refresh();
}
