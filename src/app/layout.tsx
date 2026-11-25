import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Suspense } from "react";
import { LocaleRoot } from "@/components/i18n/LocaleRoot";
import { en } from "@/lib/i18n/dictionary";
import { HTML_LANG_SCRIPT } from "@/lib/i18n/locale";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: en.common.appName,
  description: en.common.appDescription,
  applicationName: en.common.appName,
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
