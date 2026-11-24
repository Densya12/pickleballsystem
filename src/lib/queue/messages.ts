import { AUTH_MESSAGES } from "@/lib/auth/messages";
import { sessionErrorMessage } from "@/lib/session/messages";

/** Feedback after every queue action (NF8) and Taglish errors from the queue RPCs. */

export function listNames(names: readonly string[]): string {
  return names.join(", ");
}

export function needPlayersText(count: number): string {
  return `Kailangan pa ng ${count} player`;
}

/** "Tinawag sa Court 2: Ana, Ben, Carlo, Dina" */
export function calledBanner(courtLabel: string, names: readonly string[]): string {
  return `Tinawag sa ${courtLabel}: ${listNames(names)}`;
}

export function finishedBanner(input: {
  courtLabel: string;
  gameNumber: number;
  /** winners stay only */
  winners?: readonly string[] | null;
  /** The 4 called next on this court, or null when it stays empty. */
  next: readonly string[] | null;
}): string {
  const parts = [`Tapos ang Laro #${input.gameNumber} sa ${input.courtLabel}.`];
  if (input.winners?.length) parts.push(`Panalo: ${input.winners.join(" at ")}.`);
  parts.push(
    input.next
      ? `Tinawag: ${listNames(input.next)}`
      : `Bakante muna ang ${input.courtLabel}; kulang pa ang nakapila.`,
  );
  return parts.join(" ");
}

/** "Nasa pila na si Ana (pang-7)." */
export function walkInBanner(name: string, position: number | null): string {
  return position ? `Nasa pila na si ${name} (pang-${position}).` : `Nasa pila na si ${name}.`;
}

export function pausedBanner(name: string): string {
  return `Naka-pause si ${name}. Hindi siya tatawagin hanggang ituloy.`;
}

export function resumedBanner(name: string): string {
  return `Tuloy na si ${name}, sa dati niyang puwesto sa pila.`;
}

export function removedBanner(name: string): string {
  return `Inalis si ${name} sa pila.`;
}

export const QUEUE_ERRORS = {
  alreadyFinished: "Tapos na ang larong iyon. Tingnan ang court para sa bagong laro.",
  courtBusy: "May naglalaro pa sa court na ito.",
  invalidWinners: "Pumili ng 2 nanalo mula sa 4 na naglaro.",
  playerChanged: "Nagbago na ang status ng player na ito. Tingnan ulit ang pila.",
  notLive: "Hindi live ang session na ito.",
  notFound: "Hindi makita. I-refresh ang page.",
} as const;

type DbErrorLike = { code?: string; message?: string; details?: string | null };

export function queueErrorMessage(error: DbErrorLike): string {
  switch (error.message) {
    case "not_enough_players": {
      const needed = Number(error.details);
      return Number.isInteger(needed) && needed > 0
        ? `${needPlayersText(needed)} bago makatawag.`
        : "Kulang pa ang nakapila para makatawag.";
    }
    case "game_already_finished":
      return QUEUE_ERRORS.alreadyFinished;
    case "court_busy":
      return QUEUE_ERRORS.courtBusy;
    case "invalid_winners":
      return QUEUE_ERRORS.invalidWinners;
    case "invalid_player_status":
      return QUEUE_ERRORS.playerChanged;
    case "session_not_live":
      return QUEUE_ERRORS.notLive;
    case "court_not_found":
    case "player_not_found":
    case "game_not_found":
      return QUEUE_ERRORS.notFound;
    case "not_organizer_account":
      return AUTH_MESSAGES.notOrganizerAccount;
  }
  return sessionErrorMessage(error);
}
