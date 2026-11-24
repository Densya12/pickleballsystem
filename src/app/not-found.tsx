import type { Metadata } from "next";
import { Button, PageShell } from "@/components/ui";

export const metadata: Metadata = {
  title: "Hindi makita · Open Play Queue",
};

/** Unknown pages, and sessions or clubs the user isn't staff of. */
export default function NotFound() {
  return (
    <PageShell
      header={
        <div className="flex flex-col gap-2 pt-10">
          <h1 className="text-3xl">Hindi makita ang page na ito</h1>
          <p className="text-muted">Baka mali ang link, nabura na ito, o hindi ito para sa club mo.</p>
        </div>
      }
    >
      <div className="pt-4">
        <Button href="/" fullWidth size="lg">
          Pumunta sa home
        </Button>
      </div>
    </PageShell>
  );
}
