import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Suspense } from "react";
import { LocaleRoot } from "@/components/i18n/LocaleRoot";
import { APP_NAME } from "@/lib/brand";
import { en } from "@/lib/i18n/dictionary";
import { HTML_LANG_SCRIPT } from "@/lib/i18n/locale";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// latin-ext as well: the Wordmark's dotless ı (U+0131) must never fall back to another font.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600"],
  display: "swap",
});

// Pages set only their own title; the template adds " · Pilaball" (D21).
export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: en.common.appDescription,
  applicationName: APP_NAME,
};

export const viewport: Viewport = {
  themeColor: "#f4f4f1",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * The layout stays static: the language cookie is read inside <Suspense>
 * (LocaleRoot), and an inline script sets <html lang> before the first paint
 * (D20). See node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${spaceGrotesk.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: HTML_LANG_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <Suspense fallback={<div className="min-h-dvh bg-page" />}>
          <LocaleRoot>{children}</LocaleRoot>
        </Suspense>
      </body>
    </html>
  );
}
