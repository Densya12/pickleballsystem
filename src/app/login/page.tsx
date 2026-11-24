import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/ui";
import { loginErrorMessage } from "@/lib/auth/messages";
import { safeNextPath } from "@/lib/auth/paths";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Mag-sign in · Open Play Queue",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <PageShell
      header={
        <div className="flex flex-col gap-2 pt-10">
          <h1 className="text-3xl">Mag-sign in bilang organizer</h1>
          <p className="text-muted">
            Para sa nag-aayos ng open play. Hindi kailangang mag-sign in ng mga player.
          </p>
        </div>
      }
    >
      <Suspense fallback={<p className="pt-4 text-muted">Sandali lang…</p>}>
        <LoginFormFromParams searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function LoginFormFromParams({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const params = await searchParams;
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  return (
    <LoginForm
      next={safeNextPath(first(params.next))}
      initialError={loginErrorMessage(first(params.error))}
    />
  );
}
