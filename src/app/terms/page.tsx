import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { en } from "@/lib/i18n/dictionary";

export const metadata: Metadata = {
  title: en.legal.termsTitle,
};

export default function TermsPage() {
  return <LegalPage kind="terms" />;
}
