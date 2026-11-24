/**
 * "Buod ng session": the numbers for an ended session, and its CSV export.
 * Pure functions, shared by the page, the export route and their tests.
 * Each check-in row is one player (someone who left and checked in again
 * appears twice, as on the Bayad screen).
 */
import { formatPeso } from "@/lib/format";
import { summarizePayments, type PayingPlayer, type PaymentSummary } from "@/lib/payments/summary";
import { levelLabel } from "@/lib/queue/players";
import { toManilaLocal } from "@/lib/session/time";

export type SummaryPlayer = PayingPlayer & {
  level: string;
  isWalkIn: boolean;
  gamesPlayed: number;
  /** ISO time of check-in */
  checkedInAt: string;
  memberId: string | null;
};

export type SessionSummary = {
  durationMinutes: number | null;
  playerCount: number;
  totalGames: number;
  /** Highest first; ties by name. */
  gamesPerPlayer: SummaryPlayer[];
  payments: PaymentSummary;
};

export function sessionSummary(input: {
  startedAt: string | null;
  endedAt: string | null;
  fee: number;
  players: readonly SummaryPlayer[];
  gamesCount: number;
}): SessionSummary {
  const { startedAt, endedAt, fee, players, gamesCount } = input;
  const durationMinutes =
    startedAt && endedAt ? Math.max(0, Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 60_000)) : null;
  return {
    durationMinutes,
    playerCount: players.length,
    totalGames: gamesCount,
    gamesPerPlayer: [...players].sort((a, b) => b.gamesPlayed - a.gamesPlayed || a.name.localeCompare(b.name, "fil")),
    payments: summarizePayments(players, fee, { sessionEnded: true }),
  };
}

/** "2 oras 15 minuto", "45 minuto", "1 oras" */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const parts = [];
  if (hours > 0) parts.push(`${hours} oras`);
  if (rest > 0 || hours === 0) parts.push(`${rest} minuto`);
  return parts.join(" ");
}

export function paymentStatusWords(status: string, fee: number): string {
  if (fee === 0) return "Libre";
  if (status === "confirmed") return "Bayad na";
  if (status === "pending") return "I-check";
  return "Hindi pa bayad";
}

function methodWords(method: string | null): string {
  if (method === "gcash") return "GCash";
  if (method === "cash") return "Cash";
  return "";
}

// ---------------------------------------------------------------------------
// CSV (Excel): UTF-8 with a BOM so "ñ" shows correctly; CRLF line ends.
// ---------------------------------------------------------------------------

export const CSV_BOM = "﻿";

/**
 * One cell. Quoted when it has a comma, quote, line break or edge spaces.
 * Text starting with = + - @ (or a tab/CR) gets a leading ' so Excel shows
 * it as text instead of running it as a formula.
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  let text = value;
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]|^\s|\s$/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(rows: readonly (readonly (string | number | null | undefined)[])[]): string {
  return CSV_BOM + rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export const CSV_HEADER = [
  "Pangalan",
  "Level",
  "Paano pumila",
  "Laro",
  "Bayad",
  "Paraan",
  "Reference",
  "Oras ng check-in",
] as const;

/** One row per player (check-in order), then a totals row. */
export function summaryCsv(players: readonly SummaryPlayer[], fee: number): string {
  const ordered = [...players].sort((a, b) => a.checkedInAt.localeCompare(b.checkedInAt));
  const payments = summarizePayments(players, fee, { sessionEnded: true });
  const rows = ordered.map((p) => [
    p.name,
    levelLabel(p.level),
    p.isWalkIn ? "Walk-in" : "Phone",
    p.gamesPlayed,
    paymentStatusWords(p.paymentStatus, fee),
    methodWords(p.method),
    p.referenceDigits,
    toManilaLocal(new Date(p.checkedInAt)).replace("T", " "),
  ]);
  const totals = [
    "Kabuuan",
    "",
    `${players.length} players`,
    players.reduce((sum, p) => sum + p.gamesPlayed, 0),
    fee > 0
      ? `${payments.confirmed.length} bayad · ${payments.pending.length} i-check · ${payments.unpaid.length} hindi pa`
      : "Libre",
    fee > 0 ? `${formatPeso(payments.confirmedTotal)} sa ${formatPeso(payments.expectedTotal)}` : "",
    "",
    "",
  ];
  return toCsv([CSV_HEADER, ...rows, totals]);
}

/** "buod-friday-night-2026-11-24.csv" */
export function summaryFileName(sessionName: string, startedAt: string): string {
  const slug =
    sessionName
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "session";
  return `buod-${slug}-${toManilaLocal(new Date(startedAt)).slice(0, 10)}.csv`;
}
