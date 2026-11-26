import { BRAND_INK, BRAND_LIME, BRAND_ON_LIME } from "@/lib/brand";

/**
 * The pickleball (N-Logo.dc.html): a lime ball with six small holes, in a
 * 24×24 box. `edge` adds a thin ink outline for light backgrounds (the
 * "ballEdge" symbol); without it, the plain "ball" (on ink). Always decorative.
 */
export function BallShapes({ edge = false }: { edge?: boolean }) {
  if (edge) {
    return (
      <>
        <circle cx="12" cy="12" r="10.6" fill={BRAND_LIME} stroke={BRAND_INK} strokeWidth="1.6" />
        <g fill={BRAND_ON_LIME} fillOpacity="0.5">
          <circle cx="8.4" cy="8.4" r="1.5" />
          <circle cx="14.4" cy="7.4" r="1.5" />
          <circle cx="11.8" cy="12.4" r="1.5" />
          <circle cx="7.2" cy="14.4" r="1.5" />
          <circle cx="16.2" cy="13.6" r="1.5" />
          <circle cx="12" cy="17.6" r="1.5" />
        </g>
      </>
    );
  }
  return (
    <>
      <circle cx="12" cy="12" r="11" fill={BRAND_LIME} />
      <g fill={BRAND_ON_LIME} fillOpacity="0.42">
        <circle cx="8.2" cy="8" r="1.6" />
        <circle cx="14.6" cy="6.8" r="1.6" />
        <circle cx="11.6" cy="12.4" r="1.6" />
        <circle cx="6.6" cy="14.6" r="1.6" />
        <circle cx="16.6" cy="13.6" r="1.6" />
        <circle cx="12" cy="18.2" r="1.6" />
      </g>
    </>
  );
}
