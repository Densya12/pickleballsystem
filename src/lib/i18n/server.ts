import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { dictionaries, type Dictionary } from "./dictionary";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./locale";

/** The device's language (cookie), for server components, Server Actions and route handlers. */
export const getLocale = cache(async (): Promise<Locale> => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
});

export const getT = cache(async (): Promise<Dictionary> => dictionaries[await getLocale()]);
