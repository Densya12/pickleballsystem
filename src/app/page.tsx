import { Button, PageShell } from "@/components/ui";

/** Phase 0 placeholder. Real entry points arrive with the feature phases. */
export default function Home() {
  return (
    <PageShell>
      <div className="flex flex-col gap-4 pt-16">
        <h1 className="text-4xl">Open Play Queue</h1>
        <p className="text-muted">Pila, rotation at bayad para sa pickleball open play.</p>
        <Button href="/design-system" variant="secondary">
          Tingnan ang design system
        </Button>
      </div>
    </PageShell>
  );
}
