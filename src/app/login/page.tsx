import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/ui";
import { loginErrorMessage } from "@/lib/auth/messages";
import { safeNextPath } from "@/lib/auth/paths";
import { en } from "@/lib/i18n/dictionary";
import { getT } from "@/lib/i18n/server";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: `${en.auth.pageTitle} · ${en.common.appName}`,
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Suspense fallback={<PageShell>{null}</PageShell>}>
      <LoginContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginContent({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const [params, t] = await Promise.all([searchParams, getT()]);
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  return (
    <PageShell title={t.auth.title} titleSize="xl" subtitle={t.auth.subtitle}>
      <LoginForm next={safeNextPath(first(params.next))} initialError={loginErrorMessage(first(params.error), t)} />
    </PageShell>
  );
}
