import { BRAND_INK } from "@/lib/brand";
import { BallShapes } from "./Ball";

type Props = {
  /** Width and height in px. */
  size?: number;
  /** Accessible name. Without it the mark is decorative (aria-hidden). */
  label?: string;
  className?: string;
};

/**
 * The Pilaball mark (D21, N-Logo option A "the player"): an ink rounded tile,
 * a white rounded stem and a lime ball for a head: someone standing in the
 * pila. Same drawing as src/app/icon.svg.
 */
export function BrandMark({ size = 32, label, className }: Props) {
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true as const };
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" className={className} focusable="false" {...a11y}>
      <rect width="96" height="96" rx="22" fill={BRAND_INK} />
      <rect x="39" y="45" width="18" height="34" rx="9" fill="#FFFFFF" />
      <svg x="34" y="13" width="28" height="28" viewBox="0 0 24 24">
        <BallShapes />
      </svg>
    </svg>
  );
}
