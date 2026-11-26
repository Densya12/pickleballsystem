# Matchmaking simulation (Phase 9, D25 ship gate)

Date: 2026-11-27 · Branch `phase9-matchmaking` · Local database only ·
Script: `scripts/simulate-open-play.mjs` (re-run with `node scripts/simulate-open-play.mjs`).

## How it runs

Each run is a 3-hour session on the local database, played through the real RPCs
(`add_walk_in`, `call_next`, `finish_game`, `call_mixed`, `pause_player`,
`resume_player`, `remove_player`). The database decides who plays, the teams and the
rotation, as in the app. A simulated clock drives it:

- **Players:** 12, 24 or 40.
  - Levels 1–5 in a 10/25/30/25/10 % spread; 12 % have no level ("Not set").
  - 60 % arrive at the start; the rest arrive between minutes 5 and 60.
  - 10 % take a 20-minute break; 10 % leave between minutes 90 and 170.
- **Courts:** 2 or 5, all doubles.
- **Games:** 8–15 random minutes. A random side wins.
- **Organizer:** taps Call next on empty courts and Done when a game ends.
  - When a court has waited 2 minutes for a level group, they tap **Call mixed**.
- **Comparisons:** every preset × rotation for a given (courts, players) uses the same
  roster (seed), so the presets are compared on the same people.

Metrics per run:

| Metric | Meaning |
|---|---|
| Longest wait | The most games that started while one player was waiting, before they were called. |
| Games per full-timer (spread) | The range of games among players present the whole 3 hours (no break, no early exit). |
| Idle, no level group | Court-minutes empty because no group fits the levels. Also: how many times it happened, and how many Call mixed taps. |
| Idle, not enough players | Court-minutes empty because there aren't enough people. This is the same for every preset. |
| Repeat partners / opponents | Share of partner pairs (2 per game) and opponent pairs (4 per game) who were already partners / opponents earlier in the session. |
| Max skips | The highest skip count anyone reached. |

**Pass bar (D25):**

1. Mixed and Same level never skip anyone more than 2 times.
2. Their games-per-player spread for full-timers is at most Fair line + 1.
3. Mixed repeats partners less than Fair line.

Idle time from "no level group" is reported.

## Results (seed 0, all 36 runs)

| Courts | Players | Rotation | Preset | Games | Longest wait (games) | Games per full-timer (spread) | Idle, no level group (min · times · Call mixed) | Idle, not enough players (min) | Repeat partners | Repeat opponents | Max skips | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2 | 12 | All off | Fair line | 31 | 1 | 10–12 (2) | 0 · 0 · 0 | 18 | 87% | 78% | 0 | ✅ baseline |
| 2 | 12 | All off | Mixed | 30 | 3 | 9–11 (2) | 2 · 1 · 1 | 18 | 32% | 57% | 2 | ✅ ok |
| 2 | 12 | All off | Same level | 29 | 2 | 9–11 (2) | 32 · 16 · 14 | 14 | 31% | 59% | 2 | ✅ ok |
| 2 | 12 | Winners stay | Fair line | 31 | 2 | 9–12 (3) | 0 · 0 · 0 | 18 | 87% | 57% | 0 | ✅ baseline |
| 2 | 12 | Winners stay | Mixed | 31 | 3 | 9–12 (3) | 0 · 0 · 0 | 18 | 52% | 54% | 2 | ✅ ok |
| 2 | 12 | Winners stay | Same level | 27 | 3 | 8–11 (3) | 35 · 18 · 15 | 14 | 24% | 51% | 2 | ✅ ok |
| 2 | 24 | All off | Fair line | 33 | 4 | 6–7 (1) | 0 · 0 · 0 | 0 | 53% | 43% | 0 | ✅ baseline |
| 2 | 24 | All off | Mixed | 31 | 6 | 5–7 (2) | 11 · 6 · 5 | 0 | 10% | 23% | 2 | ✅ ok |
| 2 | 24 | All off | Same level | 29 | 5 | 4–6 (2) | 41 · 21 · 20 | 0 | 7% | 35% | 2 | ✅ ok |
| 2 | 24 | Winners stay | Fair line | 32 | 6 | 5–7 (2) | 0 · 0 · 0 | 0 | 59% | 17% | 0 | ✅ baseline |
| 2 | 24 | Winners stay | Mixed | 32 | 6 | 5–7 (2) | 14 · 7 · 7 | 0 | 17% | 27% | 2 | ✅ ok |
| 2 | 24 | Winners stay | Same level | 29 | 5 | 4–6 (2) | 40 · 20 · 20 | 0 | 24% | 31% | 1 | ✅ ok |
| 2 | 40 | All off | Fair line | 33 | 8 | 3–4 (1) | 0 · 0 · 0 | 0 | 48% | 37% | 0 | ✅ baseline |
| 2 | 40 | All off | Mixed | 32 | 9 | 3–4 (1) | 10 · 5 · 5 | 0 | 0% | 16% | 2 | ✅ ok |
| 2 | 40 | All off | Same level | 30 | 9 | 3–4 (1) | 45 · 23 · 22 | 0 | 20% | 23% | 2 | ✅ ok |
| 2 | 40 | Winners stay | Fair line | 32 | 14 | 2–5 (3) | 0 · 0 · 0 | 0 | 58% | 12% | 0 | ✅ baseline |
| 2 | 40 | Winners stay | Mixed | 31 | 12 | 3–5 (2) | 3 · 2 · 1 | 0 | 24% | 10% | 2 | ✅ ok |
| 2 | 40 | Winners stay | Same level | 29 | 9 | 3–4 (1) | 40 · 20 · 20 | 0 | 7% | 22% | 1 | ✅ ok |
| 5 | 12 | All off | Fair line | 44 | 1 | 14–17 (3) | 0 · 0 · 0 | 427 | 85% | 84% | 0 | ✅ baseline |
| 5 | 12 | All off | Mixed | 40 | 2 | 11–15 (4) | 78 · 39 · 13 | 373 | 64% | 74% | 2 | ✅ ok |
| 5 | 12 | All off | Same level | 39 | 2 | 12–13 (1) | 124 · 62 · 20 | 339 | 68% | 78% | 2 | ✅ ok |
| 5 | 12 | Winners stay | Fair line | 41 | 2 | 12–14 (2) | 0 · 0 · 0 | 427 | 85% | 83% | 0 | ✅ baseline |
| 5 | 12 | Winners stay | Mixed | 42 | 3 | 12–15 (3) | 40 · 20 · 6 | 399 | 67% | 76% | 2 | ✅ ok |
| 5 | 12 | Winners stay | Same level | 38 | 1 | 12–15 (3) | 152 · 79 · 26 | 325 | 71% | 80% | 1 | ✅ ok |
| 5 | 24 | All off | Fair line | 73 | 3 | 12–13 (1) | 0 · 0 · 0 | 45 | 82% | 76% | 0 | ✅ baseline |
| 5 | 24 | All off | Mixed | 74 | 5 | 11–14 (3) | 39 · 20 · 15 | 37 | 24% | 41% | 2 | ❌ spread 3 > Fair 1 + 1 |
| 5 | 24 | All off | Same level | 73 | 4 | 11–14 (3) | 78 · 40 · 34 | 34 | 34% | 55% | 2 | ❌ spread 3 > Fair 1 + 1 |
| 5 | 24 | Winners stay | Fair line | 77 | 3 | 12–14 (2) | 0 · 0 · 0 | 45 | 83% | 38% | 0 | ✅ baseline |
| 5 | 24 | Winners stay | Mixed | 73 | 6 | 11–15 (4) | 52 · 28 · 20 | 38 | 36% | 39% | 2 | ❌ spread 4 > Fair 2 + 1 |
| 5 | 24 | Winners stay | Same level | 68 | 6 | 10–13 (3) | 81 · 41 · 34 | 31 | 37% | 46% | 2 | ✅ ok |
| 5 | 40 | All off | Fair line | 82 | 5 | 7–10 (3) | 0 · 0 · 0 | 0 | 54% | 42% | 0 | ✅ baseline |
| 5 | 40 | All off | Mixed | 77 | 7 | 7–9 (2) | 54 · 29 · 24 | 0 | 12% | 27% | 2 | ✅ ok |
| 5 | 40 | All off | Same level | 71 | 8 | 7–8 (1) | 93 · 49 · 44 | 0 | 14% | 34% | 2 | ✅ ok |
| 5 | 40 | Winners stay | Fair line | 80 | 9 | 7–9 (2) | 0 · 0 · 0 | 0 | 54% | 19% | 0 | ✅ baseline |
| 5 | 40 | Winners stay | Mixed | 78 | 9 | 6–10 (4) | 35 · 19 · 16 | 0 | 24% | 15% | 2 | ❌ spread 4 > Fair 2 + 1 |
| 5 | 40 | Winners stay | Same level | 72 | 7 | 6–8 (2) | 80 · 43 · 37 | 0 | 19% | 27% | 2 | ✅ ok |

## Reading it

**Skips:** never above 2 in any run (Mixed and Same level). ✅

**Variety:** Mixed repeats partners far less than Fair line in all 12 Mixed runs.
For example, on 2 courts with 24 players (All off):

| Preset | Repeat partners |
|---|---|
| Fair line | 53 % |
| Mixed | 10 % |

Opponent repeats are lower too. ✅

**Spread:** 4 of the 24 Mixed / Same level runs miss the bar, all on **5 courts**:

| Run | Mixed / Same level spread | Fair line spread |
|---|---|---|
| 24 players, All off, Mixed | 3 | 1 |
| 24 players, All off, Same level | 3 | 1 |
| 24 players, Winners stay, Mixed | 4 | 2 |
| 40 players, Winners stay, Mixed | 4 | 2 |

The per-player breakdown (`--only 5,24,mixed,all_off --detail`) shows the cause:

| Player | Level | Games |
|---|---|---|
| The only full-time level-1 player | 1 | 11 |
| Some level-3 players, and players with no level | 3 / not set | up to 14 |

- The rarest level waits for a group and is passed over (at most twice each time).
- Middle levels and "Not set" fit more groups, so they are pulled forward.
- On 5 courts the line turns over fast, so the gap adds up.

A lower variety weight doesn't help: spread 3–4 at weights 6 and 4 as at 10.

**The 5-court result is partly noise from one seed.** Fair line's spread there swings
between 1 and 4 with the seed. Re-running the 4 failing configurations with seeds 1–3
(`--seed N`):

| Configuration | Seed 1 (Mixed · Fair) | Seed 2 | Seed 3 |
|---|---|---|---|
| 5 courts · 24 · All off · Mixed | 3 · 3 ✅ | 3 · 2 ✅ | 3 · 3 ✅ |
| 5 courts · 24 · Winners stay · Mixed | 4 · 3 ✅ | **5 · 3 ❌** | 3 · 4 ✅ |
| 5 courts · 40 · Winners stay · Mixed | 3 · 3 ✅ | 3 · 2 ✅ | 3 · 3 ✅ |
| 5 courts · 24 · All off · Same level | 3 · 3 ✅ | 3 · 2 ✅ | 3 · 3 ✅ |

11 of these 12 extra runs pass; 1 fails. In practice, Mixed and Same level on 5 courts give
full-timers a spread of about 3 games, against Fair line's 1–4.

**Idle from "no level group":**

| Preset | Courts | Court-minutes idle | Call mixed taps |
|---|---|---|---|
| Mixed | 2 | 0–14 | 0–7 |
| Mixed | 5 | 35–78 | 6–24 |
| Same level | 2 | 32–45 | 14–22 |
| Same level | 5 | 78–152 | 20–44 |

On 5 courts this is out of 900 court-minutes.

**Same level needs Call mixed often:** about two games in three on 2 courts with
24–40 players (20 of 29, 22 of 30). With five levels and a few "Not set", groups of four at exactly one
level are rare, and skip protection then blocks the court until Call mixed.

**Idle from too few players** happens only when the courts hold more than the people
present (12 players on 5 courts, about 45 % of court time), and it is the same for every
preset.

## Decisions for the owner

1. **The spread bar on 5 courts.** Mixed and Same level usually give 1–2 more games of
   spread than Fair line. Options (none built):
   - accept it (the rarest levels wait more);
   - count games played in the score, so players with fewer games are pulled forward;
   - or loosen the bar for 5+ courts.
2. **Same level stalls a lot.** Options:
   - suggest Mixed by default (already the default for new clubs);
   - let the court call mixed by itself after N minutes;
   - or allow ±1 when no exact group forms.
3. **Organizer timing.** The 2-minute "Call mixed" in this script is an assumption
   about the organizer, not something the app does.
