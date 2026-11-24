import { BallIcon } from "@/components/ui/icons";

/** "Ikaw na!" (shared by Pwesto and Mga court). */
export function CalledBanner({ name, courtLabel }: { name: string; courtLabel: string }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-card border-[1.5px] border-ink bg-accent p-5">
      <p className="inline-flex items-center gap-2 text-lg font-bold">
        <BallIcon />
        Ikaw na, {name}!
      </p>
      <p className="font-display text-3xl font-bold">Pumunta ka na sa {courtLabel}</p>
    </div>
  );
}

/** Where the Screen Wake Lock API is missing: one quiet line. */
export function KeepScreenOnNote() {
  return <p className="text-muted">Panatilihing bukas ang screen para marinig ang tawag.</p>;
}
