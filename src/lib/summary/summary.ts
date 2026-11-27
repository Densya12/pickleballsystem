/**
 * "Buod ng session": the numbers for an ended session, and its CSV export.
 * Pure functions, shared by the page, the export route and their tests.
 * Each check-in row is one player (someone who left and checked in again
 * appears twice, as on the Bayad screen).
 */
import type { Dictionary } from "@/lib/i18n/dictionary";
import { formatPeso } from "@/lib/format";
import { paidWith, type PayTo } from "@/lib/payments/method";
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

/** "2 h 15 min" / "2 oras 15 minuto" */
export function formatDuration(minutes: number, t: Dictionary): string {
  return t.time.duration(Math.floor(minutes / 60), minutes % 60);
}

/** One status word per state (D19). */
export function paymentStatusWords(status: string, fee: number, t: Dictionary): string {
  if (fee === 0) return t.common.free;
  if (status === "confirmed") return t.status.paid;
  if (status === "pending") return t.status.toCheck;
  return t.status.unpaid;
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

/** One row per player (check-in order), then a totals row. The Method column names the club's payment method (or Cash). */
export function summaryCsv(players: readonly SummaryPlayer[], fee: number, payTo: Pick<PayTo, "method" | "otherName">, t: Dictionary): string {
  const ordered = [...players].sort((a, b) => a.checkedInAt.localeCompare(b.checkedInAt));
  const payments = summarizePayments(players, fee, { sessionEnded: true });
  const rows = ordered.map((p) => [
    p.name,
    levelLabel(p.level, t),
    p.isWalkIn ? t.payments.csvWalkIn : t.payments.csvPhone,
    p.gamesPlayed,
    paymentStatusWords(p.paymentStatus, fee, t),
    paidWith(t, p.method, payTo),
    p.referenceDigits,
    toManilaLocal(new Date(p.checkedInAt)).replace("T", " "),
  ]);
  const totals = [
    t.payments.csvTotal,
    "",
    t.payments.csvPlayers(players.length),
    players.reduce((sum, p) => sum + p.gamesPlayed, 0),
    fee > 0 ? t.payments.csvCounts(payments.confirmed.length, payments.pending.length, payments.unpaid.length) : t.common.free,
    fee > 0 ? t.payments.csvAmounts(formatPeso(payments.confirmedTotal), formatPeso(payments.expectedTotal)) : "",
    "",
    "",
  ];
  return toCsv([t.payments.csvHeader, ...rows, totals]);
}

/** "summary-friday-night-2026-11-24.csv" (prefix from the dictionary). */
export function summaryFileName(sessionName: string, startedAt: string, t: Dictionary): string {
  const slug =
    sessionName
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "session";
  return `${t.payments.csvFileName}-${slug}-${toManilaLocal(new Date(startedAt)).slice(0, 10)}.csv`;
}
