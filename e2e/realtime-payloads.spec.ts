import { createClient, type RealtimePostgresChangesPayload, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import type { Database } from "../src/lib/supabase/database.types";
import { magicLinkFor, uniqueEmail } from "./support/organizer";

/**
 * Realtime privacy (carried over from Phase 3): payloads that reach an organizer
 * and a player never contain display_token, device_id or user_id.
 * Runs against the local stack with real accounts: an organizer signed in by
 * magic link and an anonymous player, both plain supabase-js clients (no browser).
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // CI-style runs can pass the variables in the environment instead.
}
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const FORBIDDEN = ["display_token", "device_id", "user_id"];
const TABLES = ["sessions", "session_players", "courts", "games"] as const;

type Payload = RealtimePostgresChangesPayload<Record<string, unknown>>;

function client(): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function must<T>(promise: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<NonNullable<T>> {
  const { data, error } = await promise;
  if (error) throw new Error(error.message);
  if (data === null || data === undefined) throw new Error("no data");
  return data;
}

async function listen(supabase: SupabaseClient<Database>, sessionId: string, into: Payload[]) {
  await supabase.realtime.setAuth();
  const channel = supabase.channel(`payloads:${sessionId}:${Math.random()}`);
  for (const table of TABLES) {
    const filter = table === "sessions" ? `id=eq.${sessionId}` : `session_id=eq.${sessionId}`;
    channel.on("postgres_changes", { event: "*", schema: "public", table, filter }, (p) => into.push(p as Payload));
  }
  await new Promise<void>((resolve, reject) => {
    channel.subscribe((status, err) => {
      if (status === "SUBSCRIBED") resolve();
      else if (status !== "CLOSED") reject(err ?? new Error(status));
    });
  });
  return channel;
}

/** For calls that return nothing: only the error matters. */
async function ok(promise: PromiseLike<{ error: { message: string } | null }>): Promise<void> {
  const { error } = await promise;
  if (error) throw new Error(error.message);
}

function keysOf(payloads: Payload[]): string[] {
  return [...new Set(payloads.flatMap((p) => [...Object.keys(p.new ?? {}), ...Object.keys(p.old ?? {})]))];
}

test("Realtime payloads never carry display_token, device_id or user_id", async () => {
  test.setTimeout(60_000);

  // Organizer: magic link (token_hash from the local Mailpit inbox).
  const organizer = client();
  const email = uniqueEmail("payloads");
  await ok(organizer.auth.signInWithOtp({ email, options: { emailRedirectTo: "http://localhost:3000/auth/confirm" } }));
  const tokenHash = new URL((await magicLinkFor(email)).replace("&token_hash", "?x=1&token_hash")).searchParams.get("token_hash");
  await ok(organizer.auth.verifyOtp({ type: "email", token_hash: tokenHash! }));

  const clubId = await must(organizer.rpc("create_club", { p_name: "Payload Club" }));
  const start = new Date();
  const sessionId = await must(
    organizer.rpc("create_session", {
      p_club_id: clubId,
      p_name: "Payload Night",
      p_starts_at: start.toISOString(),
      p_ends_at: new Date(start.getTime() + 3 * 3_600_000).toISOString(),
      p_courts_count: 1,
      p_start: true,
    }),
  );
  const { join_code } = await must(organizer.from("sessions").select("join_code").eq("id", sessionId).single());
  const court = await must(organizer.from("courts").select("id").eq("session_id", sessionId).single());

  // Player: anonymous sign-in, then check in by code.
  const player = client();
  await ok(player.auth.signInAnonymously());
  const playerId = await must(player.rpc("join_session", { p_join_code: join_code, p_display_name: "Phone Player" }));

  const organizerPayloads: Payload[] = [];
  const playerPayloads: Payload[] = [];
  const channels = [
    await listen(organizer, sessionId, organizerPayloads),
    await listen(player, sessionId, playerPayloads),
  ];

  // A full round: walk-ins, a call, not ready + swap, a finished game, and the end.
  for (const name of ["Walk One", "Walk Two", "Walk Three", "Walk Four"]) {
    await must(organizer.rpc("add_walk_in", { p_session_id: sessionId, p_display_name: name, p_level: "unsure" }));
  }
  const gameId = await must(organizer.rpc("call_next", { p_court_id: court.id }));
  await ok(player.rpc("player_not_ready", { p_player_id: playerId }));
  await must(organizer.rpc("swap_not_ready", { p_court_id: court.id, p_player_id: playerId }));
  await ok(organizer.rpc("finish_game", { p_court_id: court.id, p_game_id: gameId }));
  await ok(organizer.rpc("end_session", { p_session_id: sessionId }));

  // Both sides heard every table, including the session ending.
  for (const [who, payloads] of [["organizer", organizerPayloads], ["player", playerPayloads]] as const) {
    await expect
      .poll(() => new Set(payloads.map((p) => p.table)).size, { message: `${who} receives all 4 tables`, timeout: 10_000 })
      .toBe(4);
    await expect
      .poll(() => payloads.some((p) => p.table === "sessions" && (p.new as { status?: string }).status === "ended"), {
        message: `${who} hears the session end`,
        timeout: 10_000,
      })
      .toBe(true);
  }
  // Let any late events arrive, then check every key that came through.
  await new Promise((resolve) => setTimeout(resolve, 1_000));

  for (const [who, payloads] of [["organizer", organizerPayloads], ["player", playerPayloads]] as const) {
    const keys = keysOf(payloads);
    expect(keys, `${who} payloads include ordinary columns`).toEqual(expect.arrayContaining(["status", "display_name", "player_ids"]));
    for (const column of FORBIDDEN) expect(keys, `${who} payloads must not contain ${column}`).not.toContain(column);
  }

  for (const channel of channels) await channel.unsubscribe();
  await organizer.auth.signOut();
  await player.auth.signOut();
});
