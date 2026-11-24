import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageShell } from "@/components/ui";
import { getCurrentMembership, requireUser } from "@/lib/auth/dal";
import { CreateClubForm } from "./CreateClubForm";

export const metadata: Metadata = {
  title: "Gawin ang club mo · Open Play Queue",
};

export default function NewClubPage() {
  return (
    <PageShell
      header={
        <div className="flex flex-col gap-2 pt-10">
          <h1 className="text-3xl">Gawin ang club mo</h1>
          <p className="text-muted">Pwede mong baguhin ito mamaya sa Settings.</p>
        </div>
      }
    >
      <Suspense fallback={<p className="pt-4 text-muted">Sandali lang…</p>}>
        <NewClubGate />
      </Suspense>
    </PageShell>
  );
}

/** Signed-in users who already have a club go straight Home. */
async function NewClubGate() {
  const user = await requireUser("/club/new");
  if (await getCurrentMembership(user.id)) redirect("/");
  return (
    <div className="pt-4">
      <CreateClubForm />
    </div>
  );
}
