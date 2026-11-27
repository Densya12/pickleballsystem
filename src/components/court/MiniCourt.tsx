import { cn } from "@/lib/cn";

export type CourtChip = {
  id: string;
  name: string;
  /** The player's own chip (You're up, Courts). */
  highlight?: boolean;
  /** Said "not ready": orange chip with a dot. */
  notReady?: boolean;
  /** A word after the name, e.g. "staying" (D26 winners staying on court). */
  tag?: string;
};

/**
 * Chip positions in the 440×200 court, as % of its width/height. Doubles in
 * call order: 1 top-left, 2 bottom-left, 3 top-right, 4 bottom-right (in
 * winners stay the staying pair is called first, so it sits on the left).
 * Singles: one chip per side, centered.
 */
const DOUBLES = [
  { left: "17%", top: "25%" },
  { left: "17%", top: "75%" },
  { left: "83%", top: "25%" },
  { left: "83%", top: "75%" },
];
const SINGLES = [
  { left: "17%", top: "50%" },
  { left: "83%", top: "50%" },
];

/** Short chip labels: first names, or full names when two first names clash. */
export function chipLabels(names: readonly string[]): string[] {
  const first = names.map((n) => n.trim().split(/\s+/)[0] ?? n);
  return first.map((f, i) => (first.filter((x) => x.toLowerCase() === f.toLowerCase()).length > 1 ? names[i] : f));
}

/** The organizer's team swap (D25): chips become buttons; tap one, then one on the other side. */
export type ChipSwap = {
  selectedId: string | null;
  onTap: (playerId: string) => void;
  /** Accessible name for a chip, e.g. "Ana, Left side. Tap to swap sides". */
  label: (name: string, index: number) => string;
};

/**
 * A mini pickleball court (inline SVG, drawn at the card's width): surface,
 * kitchen zones 7 ft each side of the net, white lines, centerlines from the
 * kitchen line to each baseline, a thicker net. Team 1 (positions 1-2) is on
 * the left, team 2 on the right (D25). Decorative unless `swap` is given (the
 * names are also given as text by the caller).
 */
export function MiniCourt({
  format,
  players,
  className,
  swap,
}: {
  format: string;
  players: readonly CourtChip[];
  className?: string;
  swap?: ChipSwap;
}) {
  const spots = format === "singles" ? SINGLES : DOUBLES;
  const labels = chipLabels(players.map((p) => p.name));
  return (
    <div aria-hidden={swap ? undefined : true} className={cn("relative w-full", className)} style={{ aspectRatio: "440 / 200" }}>
      <svg
        viewBox="0 0 440 200"
        aria-hidden="true"
        className="absolute inset-0 block size-full overflow-hidden rounded-control"
        preserveAspectRatio="none"
      >
        <rect x="0" y="0" width="440" height="200" fill="#24583D" />
        <rect x="150" y="0" width="140" height="200" fill="#2E6B4A" />
        <g fill="none" stroke="#FFFFFF" strokeOpacity="0.9" strokeWidth="3">
          <rect x="6" y="6" width="428" height="188" />
          <path d="M150 6V194M290 6V194M6 100H150M290 100H434" />
        </g>
        <path d="M220 0V200" stroke="#FFFFFF" strokeWidth="5" />
      </svg>
      {players.slice(0, spots.length).map((player, index) => {
        const chipClass = cn(
          "absolute inline-flex max-w-[44%] -translate-x-1/2 -translate-y-1/2 items-center gap-1 truncate rounded-full px-2 py-1 text-xs font-semibold whitespace-nowrap shadow-chip",
          player.highlight ? "bg-accent text-on-accent" : player.notReady ? "bg-warn text-warn" : "bg-surface text-ink",
        );
        const content = (
          <>
            {player.notReady && <span className="size-1.5 shrink-0 rounded-full bg-warn-dot" />}
            <span className="truncate">{labels[index]}</span>
            {player.tag && <span className="shrink-0 font-medium opacity-80">· {player.tag}</span>}
          </>
        );
        if (!swap) {
          return (
            <span
              key={player.id}
              data-chip={player.highlight ? "me" : player.notReady ? "not-ready" : player.tag ? "staying" : "player"}
              style={spots[index]}
              className={chipClass}
            >
              {content}
            </span>
          );
        }
        const selected = swap.selectedId === player.id;
        return (
          <button
            key={player.id}
            type="button"
            data-chip={player.notReady ? "not-ready" : "player"}
            aria-pressed={selected}
            aria-label={swap.label(player.name, index)}
            onClick={() => swap.onTap(player.id)}
            style={spots[index]}
            className={cn(
              chipClass,
              "touch-target overflow-visible focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white",
              selected && "bg-accent text-on-accent ring-2 ring-white",
            )}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
