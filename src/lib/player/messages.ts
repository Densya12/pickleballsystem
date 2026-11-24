import { paymentErrorMessage } from "@/lib/payments/messages";

/** Taglish copy and error messages for the player screens. */

export const PLAYER_ERRORS = {
  closed: "Sarado na ang check-in.",
  notFound: "Hindi makita ang open play na ito. I-check ulit ang link o QR.",
  ended: "Tapos na ang open play.",
  changed: "Nagbago na ang status mo. Tingnan ulit ang pwesto mo.",
  noRow: "Wala ka na sa pila. Pumila ulit kung gusto mong maglaro.",
  signInFailed: "Hindi ka ma-check in ngayon. Sabihin na lang sa organizer ang pangalan mo.",
  invalidInput: "May mali sa nilagay. I-check ang pangalan mo.",
  generic: "May problema. Subukan ulit.",
} as const;

type DbErrorLike = { code?: string; message?: string };

export function playerErrorMessage(error: DbErrorLike): string {
  const payment = paymentErrorMessage(error);
  if (payment) return payment;
  switch (error.message) {
    case "checkin_closed":
      return PLAYER_ERRORS.closed;
    case "session_not_found":
      return PLAYER_ERRORS.notFound;
    case "session_not_live":
      return PLAYER_ERRORS.ended;
    case "invalid_player_status":
      return PLAYER_ERRORS.changed;
    case "player_not_found":
      return PLAYER_ERRORS.noRow;
  }
  if (error.code === "23514" || error.code === "23502") return PLAYER_ERRORS.invalidInput;
  return PLAYER_ERRORS.generic;
}

/** "N ang nakapila · N courts" */
export function waitingLine(waiting: number, courts: number): string {
  return `${waiting} ang nakapila · ${courts} ${courts === 1 ? "court" : "courts"}`;
}
