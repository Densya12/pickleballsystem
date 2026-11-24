import "server-only";
import QRCode from "qrcode";

/** QR code as an SVG string, made locally (no external service). */
export function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    color: { dark: "#111412", light: "#ffffff" },
  });
}

/** Join codes: 6 characters without look-alikes (no 0, O, 1, I, L); case-insensitive. */
export function normalizeJoinCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  return /^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/.test(code) ? code : null;
}
