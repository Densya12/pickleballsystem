import { levelFromSkill } from "@/lib/queue/players";
import { parsePreview, type QueuePreview } from "@/lib/queue/preview";
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CourtGame, CourtInfo } from "./courts";
import type { CallRules, Me, QueuePlayer, RunningGame } from "./state";

/**
 * Player-side reads. The check-in preview is public; everything else is read
 * as the signed-in player (RLS: players of the session) and "which row is me"
 * comes only from my_player().
 */

export type CheckinPreview = {
  status: "live" | "draft" | "ended" | "not_found";
  name: string | null;
  startsAt: string | null;
  endsAt: string | null;
  courtsCount: number | null;
  waiting: number | null;
  fee: number;
  payFirst: boolean;
  gcashName: string | null;
  gcashNumber: string | null;
};

export async function getCheckinPreview(code: string): Promise<CheckinPreview> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("checkin_preview", { p_join_code: code }).maybeSingle();
  if (error) throw new Error(`Could not load check-in: ${error.message}`);
  return {
    status: (data?.status ?? "not_found") as CheckinPreview["status"],
    name: data?.name ?? null,
    startsAt: data?.starts_at ?? null,
    endsAt: data?.ends_at ?? null,
    courtsCount: data?.courts_count ?? null,
    waiting: data?.waiting ?? null,
    fee: data?.fee ?? 0,
    payFirst: data?.pay_first ?? false,
    gcashName: data?.gcash_name ?? null,
    gcashNumber: data?.gcash_number ?? null,
  };
}

/**
 * D18: a returning player's name and level, from their own latest row in this
 * club. Null when this phone has never checked in here (or isn't signed in).
 */
export async function getLastProfile(code: string): Promise<{ name: string; level: string } | null> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return null;
  const { data, error } = await supabase.rpc("my_last_profile_v2", { p_join_code: code }).maybeSingle();
  if (error) throw new Error(`Could not load your last check-in: ${error.message}`);
  return data ? { name: data.display_name, level: levelFromSkill(data.skill) } : null;
}

export type PlayerSessionView = {
  session: { id: string; name: string; status: string; startsAt: string; endsAt: string };
  me: Me | null;
  players: QueuePlayer[];
  games: RunningGame[];
  /** One entry per court (for the "next up" window). */
  courtFormats: string[];
  /** Mga court (D14): every court in order, and the running game on each. */
  courts: CourtInfo[];
  courtGames: CourtGame[];
  /** The session's payment rule (BR6) and what to pay. */
  rules: CallRules;
  gcash: { name: string | null; number: string | null };
  /** The caller's own payment (NF14: only their own row is readable). */
  payment: { status: string; method: string | null; referenceDigits: string | null };
  /** D25: who plays together, the player's level, and the server's next group. */
  matchmaking: string;
  mySkill: number | null;
  preview: QueuePreview | null;
};

/** The session behind a join code, if the caller may read it (player or staff). */
export async function getPlayerSessionView(code: string): Promise<PlayerSessionView | null> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return null;

  const { data: session, error } = await supabase
    .from("sessions")
    .select("id, name, status, starts_at, ends_at, fee, pay_first, gcash_name, gcash_number, matchmaking")
    .eq("join_code", code)
    .maybeSingle();
  if (error) throw new Error(`Could not load session: ${error.message}`);
  if (!session) return null;

  const [me, players, courts, games, preview] = await Promise.all([
    supabase.rpc("my_player", { p_session_id: session.id }).maybeSingle(),
    supabase
      .from("session_players")
      .select("id, display_name, status, queue_pos, payment_status, skill")
      .eq("session_id", session.id)
      .neq("status", "left")
      .order("queue_pos"),
    supabase.from("courts").select("id, label, format").eq("session_id", session.id).order("number"),
    supabase.from("games").select("id, number, court_id, format, player_ids").eq("session_id", session.id).is("ended_at", null),
    supabase.rpc("queue_preview", { p_session_id: session.id }),
  ]);
  for (const result of [me, players, courts, games]) {
    if (result.error) throw new Error(`Could not load your place in line: ${result.error.message}`);
  }

  const courtLabel = new Map((courts.data ?? []).map((c) => [c.id, c.label]));
  const myRow = me.data ? (players.data ?? []).find((p) => p.id === me.data!.id) : undefined;
  const { data: myPayment } = me.data
    ? await supabase.from("payments").select("method, reference_digits, status").eq("session_player_id", me.data.id).maybeSingle()
    : { data: null };
  return {
    session: {
      id: session.id,
      name: session.name,
      status: session.status,
      startsAt: session.starts_at,
      endsAt: session.ends_at,
    },
    me: me.data
      ? { id: me.data.id, name: me.data.display_name, status: me.data.status, notReady: me.data.not_ready_at !== null }
      : null,
    players: (players.data ?? []).map((p) => ({
      id: p.id,
      name: p.display_name,
      status: p.status,
      queuePos: p.queue_pos,
      paymentStatus: p.payment_status,
    })),
    games: (games.data ?? []).map((g) => ({
      id: g.id,
      number: g.number,
      courtLabel: courtLabel.get(g.court_id) ?? "",
      format: g.format,
      playerIds: g.player_ids,
    })),
    courtFormats: (courts.data ?? []).map((c) => c.format),
    courts: (courts.data ?? []).map((c) => ({ id: c.id, label: c.label, format: c.format })),
    courtGames: (games.data ?? []).map((g) => ({ id: g.id, number: g.number, courtId: g.court_id, playerIds: g.player_ids })),
    rules: { payFirst: session.pay_first, fee: session.fee },
    gcash: { name: session.gcash_name, number: session.gcash_number },
    payment: {
      status: myRow?.payment_status ?? "unpaid",
      method: myPayment?.method ?? null,
      referenceDigits: myPayment?.reference_digits ?? null,
    },
    matchmaking: session.matchmaking,
    mySkill: myRow?.skill ?? null,
    // A preview failure must not break My place: the screen falls back to queue order.
    preview: preview.error ? null : parsePreview(preview.data),
  };
}
