import type { ReactNode } from "react";
import { I18nProvider } from "@/lib/i18n/client";
import { getLocale } from "@/lib/i18n/server";

/** Reads the language cookie once per request and gives it to client components. */
export async function LocaleRoot({ children }: { children: ReactNode }) {
  return <I18nProvider locale={await getLocale()}>{children}</I18nProvider>;
}
