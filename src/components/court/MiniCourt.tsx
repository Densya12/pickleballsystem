import { cn } from "@/lib/cn";

export type CourtChip = {
  id: string;
  name: string;
  /** The player's own chip (You're up, Courts). */
  highlight?: boolean;
  /** Said "not ready": orange chip with a dot. */
  notReady?: boolean;
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

/**
 * A mini pickleball court (inline SVG, drawn at the card's width): surface,
 * kitchen zones 7 ft each side of the net, white lines, centerlines from the
 * kitchen line to each baseline, a thicker net. Decorative: the names are
 * also given as text by the caller.
 */
export function MiniCourt({ format, players, className }: { format: string; players: readonly CourtChip[]; className?: string }) {
  const spots = format === "singles" ? SINGLES : DOUBLES;
  const labels = chipLabels(players.map((p) => p.name));
  return (
    <div aria-hidden="true" className={cn("relative w-full", className)} style={{ aspectRatio: "440 / 200" }}>
      <svg viewBox="0 0 440 200" className="absolute inset-0 block size-full overflow-hidden rounded-control" preserveAspectRatio="none">
        <rect x="0" y="0" width="440" height="200" fill="#24583D" />
        <rect x="150" y="0" width="140" height="200" fill="#2E6B4A" />
        <g fill="none" stroke="#FFFFFF" strokeOpacity="0.9" strokeWidth="3">
          <rect x="6" y="6" width="428" height="188" />
          <path d="M150 6V194M290 6V194M6 100H150M290 100H434" />
        </g>
        <path d="M220 0V200" stroke="#FFFFFF" strokeWidth="5" />
      </svg>
      {players.slice(0, spots.length).map((player, index) => (
        <span
          key={player.id}
          data-chip={player.highlight ? "me" : player.notReady ? "not-ready" : "player"}
          style={spots[index]}
          className={cn(
            "absolute inline-flex max-w-[44%] -translate-x-1/2 -translate-y-1/2 items-center gap-1 truncate rounded-full px-2 py-1 text-xs font-semibold whitespace-nowrap shadow-chip",
            player.highlight ? "bg-accent text-on-accent" : player.notReady ? "bg-warn text-warn" : "bg-surface text-ink",
          )}
        >
          {player.notReady && <span className="size-1.5 shrink-0 rounded-full bg-warn-dot" />}
          <span className="truncate">{labels[index]}</span>
        </span>
      ))}
    </div>
  );
}
