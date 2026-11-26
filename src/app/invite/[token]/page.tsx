import type { Metadata } from "next";
import { Suspense } from "react";
import { Button, Card, Notice, PageShell } from "@/components/ui";
import { requireUser } from "@/lib/auth/dal";
import { inviteStatusMessage, type InviteStatus } from "@/lib/club/messages";
import { en } from "@/lib/i18n/dictionary";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { JoinForm } from "./JoinForm";

export const metadata: Metadata = {
  title: en.club.invitePageTitle,
};

export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  return (
    <Suspense fallback={<PageShell>{null}</PageShell>}>
      <InviteContent params={params} />
    </Suspense>
  );
}

async function InviteContent({ params }: Pick<PageProps<"/invite/[token]">, "params">) {
  const { token } = await params;
  // The proxy already sends signed-out visitors to /login?next=/invite/<token>.
  await requireUser(`/invite/${encodeURIComponent(token)}`);
  const t = await getT();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invite_preview", { p_token: token });
  const preview = data?.[0];
  const status: InviteStatus = error || !preview ? "invalid" : (preview.status as InviteStatus);

  if (status === "valid" && preview?.already_staff) {
    return (
      <PageShell title={t.club.inviteAlready(preview.club_name)} titleSize="xl" footer={<Button href="/" fullWidth>{t.club.inviteGoHome}</Button>}>
        {null}
      </PageShell>
    );
  }

  if (status === "valid" && preview) {
    return (
      <PageShell title={t.club.inviteJoinTitle(preview.club_name)} titleSize="xl" footer={<JoinForm token={token} />}>
        <Card>
          <p>{t.club.inviteJoinBody}</p>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={t.club.inviteUnusable}
      titleSize="xl"
      footer={
        <Button href="/" variant="secondary" fullWidth>
          {t.system.backHome}
        </Button>
      }
    >
      <Notice kind="error">{inviteStatusMessage(status === "valid" ? "invalid" : status, t)}</Notice>
    </PageShell>
  );
}
