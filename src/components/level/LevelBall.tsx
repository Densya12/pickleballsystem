import { BallShapes } from "@/components/brand/Ball";
import { cn } from "@/lib/cn";

/**
 * The level icon (D25): the brand's lime pickleball when filled, an outline
 * ball when not. Decorative: the level is always given as text too.
 */
export function LevelBall({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={cn("shrink-0", className)}>
      {filled ? (
        <BallShapes edge />
      ) : (
        // Outline: the form-field border (#878C88, >= 3:1 on white and on the page).
        <circle cx="12" cy="12" r="10.4" fill="none" stroke="#878C88" strokeWidth="1.6" />
      )}
    </svg>
  );
}
