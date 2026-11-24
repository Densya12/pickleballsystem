import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { Button, Card, Notice, PageShell } from "@/components/ui";
import { requireUser } from "@/lib/auth/dal";
import { inviteStatusMessage, type InviteStatus } from "@/lib/club/messages";
import { createClient } from "@/lib/supabase/server";
import { JoinForm } from "./JoinForm";

export const metadata: Metadata = {
  title: "Invite · Open Play Queue",
};

export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  return (
    <Suspense
      fallback={
        <PageShell>
          <p className="pt-10 text-muted">Sandali lang…</p>
        </PageShell>
      }
    >
      <InviteContent params={params} />
    </Suspense>
  );
}

async function InviteContent({ params }: Pick<PageProps<"/invite/[token]">, "params">) {
  const { token } = await params;
  // The proxy already sends signed-out visitors to /login?next=/invite/<token>.
  await requireUser(`/invite/${encodeURIComponent(token)}`);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invite_preview", { p_token: token });
  const preview = data?.[0];
  const status: InviteStatus = error || !preview ? "invalid" : (preview.status as InviteStatus);

  if (status === "valid" && preview?.already_staff) {
    return (
      <InviteShell title={`Kasali ka na sa ${preview.club_name}`}>
        <Button href="/" fullWidth size="lg">
          Pumunta sa home
        </Button>
      </InviteShell>
    );
  }

  if (status === "valid" && preview) {
    return (
      <InviteShell title={`Sumali bilang organizer ng ${preview.club_name}`}>
        <Card className="flex flex-col gap-4">
          <p>
            Makakatulong ka sa pag-aayos ng open play ng club na ito. Ang owner pa rin ang
            magbabago ng settings.
          </p>
          <JoinForm token={token} />
        </Card>
      </InviteShell>
    );
  }

  return (
    <InviteShell title="Hindi magamit ang invite">
      <div className="flex flex-col gap-4">
        <Notice kind="error">{inviteStatusMessage(status === "valid" ? "invalid" : status)}</Notice>
        <Button href="/" variant="secondary" fullWidth>
          Bumalik sa home
        </Button>
      </div>
    </InviteShell>
  );
}

function InviteShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <PageShell
      header={
        <div className="pt-10">
          <h1 className="text-3xl break-words">{title}</h1>
        </div>
      }
    >
      <div className="pt-4">{children}</div>
    </PageShell>
  );
}
