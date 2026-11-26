// D25 ship gate: simulate open play against the LOCAL database through the real RPCs.
//
//   npx supabase start
//   node scripts/simulate-open-play.mjs                 # every run (2 and 5 courts; 12, 24, 40 players; 3 presets; 2 rotations)
//   node scripts/simulate-open-play.mjs --quick         # a smaller set
//   node scripts/simulate-open-play.mjs --out docs/qa/2026-11-matchmaking-sim.md
//
// A simulated clock drives each 3-hour session: staggered arrivals, a few breaks and
// leavers, games of 8-15 random minutes, a random side wins each game. The script
// is the organizer: it taps Call next on empty courts, Done when a game ends, and
// "Call mixed" when a court has waited 2 minutes for a level group. Everything
// else (who is called, teams, rotation) is decided by the database, as in the app.
// Same seed per (courts, players), so the presets are compared on the same roster.
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const QUICK = args.includes("--quick");
const OUT = args.includes("--out") ? args[args.indexOf("--out") + 1] : null;
// --only 5,24,mixed,all_off : one run, with games per full-time player by level.
const ONLY = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",") : null;
// --seed N : another roster and other game lengths (default 0).
const SEED = args.includes("--seed") ? Number(args[args.indexOf("--seed") + 1]) : 0;
const DURATION = 180;
const MIXED_CALL_AFTER = 2; // minutes a court waits for a level group before the organizer taps Call mixed

const status = JSON.parse(execSync("npx supabase status -o json 2>/dev/null", { encoding: "utf8" }));
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(status.API_URL)) throw new Error("Refusing to run: not the local stack");
const KEY = status.ANON_KEY ?? status.PUBLISHABLE_KEY;
const org = createClient(status.API_URL, KEY, { auth: { persistSession: false } });

/** Deterministic random numbers (mulberry32). */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const between = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));

/** Who comes, when, at what level; who takes a break or leaves early. */
function roster(seed, n) {
  const r = rng(seed);
  const weights = [0.1, 0.25, 0.3, 0.25, 0.1];
  return Array.from({ length: n }, (_, i) => {
    let level = null;
    if (r() >= 0.12) {
      let x = r();
      level = 1;
      for (const w of weights) {
        if ((x -= w) < 0) break;
        level += 1;
      }
      level = Math.min(level, 5);
    }
    const arrival = i < Math.round(n * 0.6) ? 0 : between(r, 5, 60);
    const roll = r();
    const breakAt = roll < 0.1 ? between(r, 40, 140) : null;
    const leaveAt = roll >= 0.1 && roll < 0.2 ? between(r, 90, 170) : null;
    return { name: `Sim ${String(i + 1).padStart(2, "0")}`, level, arrival, breakAt, breakLen: 20, leaveAt };
  });
}

async function must(promise, what) {
  const { data, error } = await promise;
  if (error) throw new Error(`${what}: ${error.message}${error.details ? ` (${error.details})` : ""}`);
  return data;
}

async function runOne(clubId, { courts, n, preset, rotation, seed }) {
  const r = rng(seed * 7919 + preset.length * 31 + rotation.length);
  const people = roster(seed, n);
  const start = new Date();
  const sessionId = await must(
    org.rpc("create_session", {
      p_club_id: clubId,
      p_name: `Sim ${courts}c ${n}p ${preset} ${rotation}`,
      p_starts_at: start.toISOString(),
      p_ends_at: new Date(start.getTime() + DURATION * 60_000).toISOString(),
      p_courts_count: courts,
      p_rotation: rotation,
      p_fee: 0,
      p_start: true,
      p_court_formats: Array(courts).fill("doubles"),
    }),
    "create_session",
  );
  await must(org.rpc("set_session_matchmaking", { p_session_id: sessionId, p_matchmaking: preset }), "set_session_matchmaking");
  const courtRows = await must(org.from("courts").select("id, number").eq("session_id", sessionId).order("number"), "courts");

  const players = people.map((p) => ({ ...p, id: null, state: "away", wait: 0, longest: 0, pendingBreak: false, pendingLeave: false, resumeAt: null }));
  const byId = new Map();
  const court = courtRows.map((c) => ({ id: c.id, gameId: null, playerIds: [], endsAt: null, blockedSince: null }));
  const stats = { games: 0, idleNoGroup: 0, idleNotEnough: 0, noGroupEpisodes: 0, mixedCalls: 0, partnerPairs: 0, partnerRepeats: 0, oppPairs: 0, oppRepeats: 0, maxSkip: 0 };
  const seenPartners = new Set();
  const seenOpponents = new Set();
  const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

  async function onGameStarted(c, gameId, t) {
    const game = await must(org.from("games").select("player_ids").eq("id", gameId).single(), "game");
    c.gameId = gameId;
    c.playerIds = game.player_ids;
    c.endsAt = t + between(r, 8, 15);
    c.blockedSince = null;
    stats.games += 1;
    const ids = game.player_ids;
    for (const p of players) {
      if (p.state === "queued" && !ids.includes(p.id)) p.wait += 1;
    }
    for (const id of ids) {
      const p = byId.get(id);
      p.longest = Math.max(p.longest, p.wait);
      p.wait = 0;
      p.state = "playing";
    }
    const partners = [key(ids[0], ids[1]), key(ids[2], ids[3])];
    const opponents = [key(ids[0], ids[2]), key(ids[0], ids[3]), key(ids[1], ids[2]), key(ids[1], ids[3])];
    for (const k of partners) {
      stats.partnerPairs += 1;
      if (seenPartners.has(k)) stats.partnerRepeats += 1;
      seenPartners.add(k);
    }
    for (const k of opponents) {
      stats.oppPairs += 1;
      if (seenOpponents.has(k)) stats.oppRepeats += 1;
      seenOpponents.add(k);
    }
    const skips = await must(org.from("session_players").select("skip_count").eq("session_id", sessionId).order("skip_count", { ascending: false }).limit(1), "skips");
    stats.maxSkip = Math.max(stats.maxSkip, skips[0]?.skip_count ?? 0);
  }

  async function fillCourts(t) {
    for (const c of court) {
      if (c.gameId) continue;
      if (c.blockedSince !== null && t - c.blockedSince >= MIXED_CALL_AFTER) {
        const { data, error } = await org.rpc("call_mixed", { p_court_id: c.id });
        if (!error) {
          stats.mixedCalls += 1;
          await onGameStarted(c, data, t);
          continue;
        }
      }
      const { data, error } = await org.rpc("call_next", { p_court_id: c.id });
      if (!error) {
        await onGameStarted(c, data, t);
      } else if (error.message === "no_level_group") {
        if (c.blockedSince === null) {
          c.blockedSince = t;
          stats.noGroupEpisodes += 1;
        }
      } else if (error.message === "not_enough_players") {
        c.blockedSince = null;
      } else {
        throw new Error(`call_next: ${error.message}`);
      }
    }
  }

  async function releaseAfterGame(id) {
    const p = byId.get(id);
    if (!p || p.state !== "queued") return;
    if (p.pendingLeave) {
      await must(org.rpc("remove_player", { p_player_id: id }), "remove");
      p.state = "left";
    } else if (p.pendingBreak) {
      await must(org.rpc("pause_player", { p_player_id: id }), "pause");
      p.state = "paused";
      p.pendingBreak = false;
    }
  }

  let t = 0;
  while (t < DURATION) {
    // Roster events at this minute.
    for (const p of players) {
      if (p.state === "away" && p.arrival <= t) {
        p.id = await must(
          org.rpc("add_walk_in", { p_session_id: sessionId, p_display_name: p.name, p_level: p.level ? String(p.level) : "unsure" }),
          "add_walk_in",
        );
        byId.set(p.id, p);
        p.state = "queued";
      }
      if (p.breakAt !== null && p.breakAt <= t && p.resumeAt === null && p.state !== "left") {
        p.resumeAt = p.breakAt + p.breakLen;
        if (p.state === "queued") {
          await must(org.rpc("pause_player", { p_player_id: p.id }), "pause");
          p.state = "paused";
        } else if (p.state === "playing") {
          p.pendingBreak = true;
        }
      }
      if (p.state === "paused" && p.resumeAt !== null && p.resumeAt <= t) {
        await must(org.rpc("resume_player", { p_player_id: p.id }), "resume");
        p.state = "queued";
        p.wait = 0;
      }
      if (p.leaveAt !== null && p.leaveAt <= t && p.state !== "left") {
        if (p.state === "playing") p.pendingLeave = true;
        else if (p.state === "queued" || p.state === "paused") {
          await must(org.rpc("remove_player", { p_player_id: p.id }), "remove");
          p.state = "left";
        }
      }
    }

    // Games that end now (Done, a random side wins).
    for (const c of court) {
      if (c.gameId && c.endsAt <= t) {
        const finished = c.playerIds;
        const side = r() < 0.5 ? finished.slice(0, 2) : finished.slice(2, 4);
        const next = await must(org.rpc("finish_game", { p_court_id: c.id, p_game_id: c.gameId, p_winner_ids: side }), "finish_game");
        for (const id of finished) {
          const p = byId.get(id);
          if (p && p.state === "playing") {
            p.state = "queued";
            p.wait = 0;
          }
        }
        c.gameId = null;
        c.playerIds = [];
        if (next) await onGameStarted(c, next, t);
        for (const id of finished) await releaseAfterGame(id);
      }
    }

    await fillCourts(t);

    // Advance to the next thing that can happen (at least 1 minute).
    const upcoming = [DURATION];
    for (const c of court) {
      if (c.gameId) upcoming.push(c.endsAt);
      if (c.blockedSince !== null) upcoming.push(c.blockedSince + MIXED_CALL_AFTER);
    }
    for (const p of players) {
      if (p.state === "away") upcoming.push(p.arrival);
      if (p.breakAt !== null && p.resumeAt === null) upcoming.push(p.breakAt);
      if (p.resumeAt !== null && p.state === "paused") upcoming.push(p.resumeAt);
      if (p.leaveAt !== null && p.state !== "left") upcoming.push(p.leaveAt);
    }
    const nextT = Math.max(t + 1, Math.min(...upcoming.filter((x) => x > t)));
    for (const c of court) {
      if (!c.gameId) {
        const minutes = Math.min(nextT, DURATION) - t;
        if (c.blockedSince !== null) stats.idleNoGroup += minutes;
        else stats.idleNotEnough += minutes;
      }
    }
    t = nextT;
  }

  await must(org.rpc("end_session", { p_session_id: sessionId }), "end_session");
  const rows = await must(org.from("session_players").select("display_name, games_played").eq("session_id", sessionId), "players");
  const played = new Map(rows.map((row) => [row.display_name, row.games_played]));
  const fullTimers = players.filter((p) => p.arrival === 0 && p.breakAt === null && p.leaveAt === null);
  const fullTime = fullTimers.map((p) => played.get(p.name) ?? 0);
  if (ONLY) {
    if (args.includes("--detail")) {
      for (const p of fullTimers) console.log(`  ${p.name} level ${p.level ?? "-"}: ${played.get(p.name)} games, longest wait ${p.longest}`);
    }
  }
  return {
    courts,
    n,
    preset,
    rotation,
    games: stats.games,
    longestWait: Math.max(0, ...players.map((p) => p.longest)),
    spread: fullTime.length ? Math.max(...fullTime) - Math.min(...fullTime) : 0,
    fullTimeRange: fullTime.length ? `${Math.min(...fullTime)}–${Math.max(...fullTime)}` : "–",
    idleNoGroup: stats.idleNoGroup,
    noGroupEpisodes: stats.noGroupEpisodes,
    mixedCalls: stats.mixedCalls,
    idleNotEnough: stats.idleNotEnough,
    partnerRepeat: stats.partnerPairs ? stats.partnerRepeats / stats.partnerPairs : 0,
    opponentRepeat: stats.oppPairs ? stats.oppRepeats / stats.oppPairs : 0,
    maxSkip: stats.maxSkip,
  };
}

const stamp = Date.now();
await must(org.auth.signUp({ email: `sim-${stamp}@example.com`, password: `SimPass-${stamp}!` }), "sign up");
const clubId = await must(org.rpc("create_club", { p_name: `Simulation ${stamp}`, p_city: null }), "create_club");

const COURTS = ONLY ? [Number(ONLY[0])] : QUICK ? [2] : [2, 5];
const PLAYERS = ONLY ? [Number(ONLY[1])] : QUICK ? [12, 24] : [12, 24, 40];
const PRESETS = ONLY ? ["fair_line", ONLY[2]] : ["fair_line", "mixed", "same_level"];
const ROTATIONS = ONLY ? [ONLY[3]] : ["all_off", "winners_stay"];
const results = [];
for (const courts of COURTS) {
  for (const n of PLAYERS) {
    for (const rotation of ROTATIONS) {
      for (const preset of PRESETS) {
        const seed = courts * 1000 + n + SEED * 100_003;
        const result = await runOne(clubId, { courts, n, preset, rotation, seed });
        results.push(result);
        console.log(JSON.stringify(result));
      }
    }
  }
}

// Pass bar (D25): Mixed and Same level never skip anyone more than 2 times; their spread of
// games among full-time players is at most Fair line + 1; Mixed repeats partners less than
// Fair line. Court idle time from "no level group" is reported per run.
const pct = (x) => `${Math.round(x * 100)}%`;
const fairOf = (r) => results.find((x) => x.courts === r.courts && x.n === r.n && x.rotation === r.rotation && x.preset === "fair_line");
const checks = results.map((r) => {
  if (r.preset === "fair_line") return { r, pass: true, why: "baseline" };
  const fair = fairOf(r);
  const why = [];
  if (r.maxSkip > 2) why.push(`skips ${r.maxSkip} > 2`);
  if (r.spread > fair.spread + 1) why.push(`spread ${r.spread} > Fair ${fair.spread} + 1`);
  if (r.preset === "mixed" && !(r.partnerRepeat < fair.partnerRepeat)) why.push(`partner repeats ${pct(r.partnerRepeat)} not below Fair ${pct(fair.partnerRepeat)}`);
  return { r, pass: why.length === 0, why: why.join("; ") || "ok" };
});
const label = { fair_line: "Fair line", mixed: "Mixed", same_level: "Same level", all_off: "All off", winners_stay: "Winners stay" };
const lines = [
  "| Courts | Players | Rotation | Preset | Games | Longest wait (games) | Games per full-timer (spread) | Idle, no level group (min · times · Call mixed) | Idle, not enough players (min) | Repeat partners | Repeat opponents | Max skips | Pass |",
  "|---|---|---|---|---|---|---|---|---|---|---|---|---|",
  ...checks.map(({ r, pass, why }) =>
    `| ${r.courts} | ${r.n} | ${label[r.rotation]} | ${label[r.preset]} | ${r.games} | ${r.longestWait} | ${r.fullTimeRange} (${r.spread}) | ${r.idleNoGroup} · ${r.noGroupEpisodes} · ${r.mixedCalls} | ${r.idleNotEnough} | ${pct(r.partnerRepeat)} | ${pct(r.opponentRepeat)} | ${r.maxSkip} | ${pass ? "✅" : "❌"} ${why} |`,
  ),
];
const table = lines.join("\n");
console.log(`\n${table}\n`);
const failed = checks.filter((c) => !c.pass);
console.log(failed.length ? `${failed.length} run(s) fail the bar.` : "Every run passes the bar.");
if (OUT) writeFileSync(OUT, table + "\n");
process.exitCode = failed.length ? 1 : 0;
