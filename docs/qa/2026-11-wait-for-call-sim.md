# Wait for me (D26): open-play simulation

`node scripts/simulate-open-play.mjs --call-mode both` (seed 0), against the local database through the
real RPCs. Every configuration of the D25 run (2 and 5 courts; 12, 24, 40 players; All off and Winners
stay; Fair line, Mixed, Same level) is played twice on the same roster and game lengths: **Auto**
(today: Done calls the next group) and **Wait for me** (Done calls nobody; the script's organizer taps
Call 30–60 s later, at a random moment in that range; after a failed Call it retries as players arrive;
"Call mixed" after 2 minutes with no level group, as before).

**Idle, waiting for Call** is the time courts sat empty between Done and the organizer's tap, summed over
all courts. It also counts the delay when Call would have found too few players (12 players on 5 courts).

## Summary

- **Auto-call is unchanged**: every Auto row equals the Phase 9 (D25) run.
- **Idle from waiting for Call**, per 3-hour session:
  - 2 courts: 19–29 min in total (about 45 s per game), 0–3 fewer games than Auto (about 6 %).
  - 5 courts with 24–40 players: 48–71 min in total over the 5 courts, 0–7 fewer games (up to 9 %).
  - 5 courts with 12 players: 191–268 min, mostly time when not enough players were waiting anyway
    ("not enough players" idle drops by about the same amount).
- **Skips** never above 2. **Mixed** repeats partners less than Fair line in every run.
- **Spread**: 4 Wait-for-me runs miss the Fair + 1 bar (Fair line's own spread moves between runs,
  e.g. 2·12 Winners stay: Fair 3 with Auto, 1 with Wait for me). The 4 Auto failures are the ones
  already reported for Phase 9.

## Table

| Courts | Players | Rotation | Preset | Next game | Games | Longest wait (games) | Games per full-timer (spread) | Idle, no level group (min · times · Call mixed) | Idle, not enough players (min) | Idle, waiting for Call (min) | Repeat partners | Repeat opponents | Max skips | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2 | 12 | All off | Fair line | Auto | 31 | 1 | 10–12 (2) | 0 · 0 · 0 | 18 | 0 | 87% | 78% | 0 | ✅ baseline |
| 2 | 12 | All off | Fair line | Wait for me | 29 | 2 | 9–12 (3) | 0 · 0 · 0 | 11 | 27.3 | 84% | 75% | 0 | ✅ baseline |
| 2 | 12 | All off | Mixed | Auto | 30 | 3 | 9–11 (2) | 2 · 1 · 1 | 18 | 0 | 32% | 57% | 2 | ✅ ok |
| 2 | 12 | All off | Mixed | Wait for me | 28 | 4 | 8–11 (3) | 0 · 0 · 0 | 15 | 22.1 | 41% | 54% | 2 | ✅ ok |
| 2 | 12 | All off | Same level | Auto | 29 | 2 | 9–11 (2) | 32 · 16 · 14 | 14 | 0 | 31% | 59% | 2 | ✅ ok |
| 2 | 12 | All off | Same level | Wait for me | 29 | 3 | 9–11 (2) | 31.7 · 16 · 13 | 10 | 23.8 | 22% | 56% | 2 | ✅ ok |
| 2 | 12 | Winners stay | Fair line | Auto | 31 | 2 | 9–12 (3) | 0 · 0 · 0 | 18 | 0 | 87% | 57% | 0 | ✅ baseline |
| 2 | 12 | Winners stay | Fair line | Wait for me | 30 | 3 | 10–11 (1) | 0 · 0 · 0 | 9 | 29 | 82% | 51% | 0 | ✅ baseline |
| 2 | 12 | Winners stay | Mixed | Auto | 31 | 3 | 9–12 (3) | 0 · 0 · 0 | 18 | 0 | 52% | 54% | 2 | ✅ ok |
| 2 | 12 | Winners stay | Mixed | Wait for me | 29 | 4 | 8–12 (4) | 0 · 0 · 0 | 9 | 28.6 | 47% | 50% | 2 | ❌ spread 4 > Fair 1 + 1 |
| 2 | 12 | Winners stay | Same level | Auto | 27 | 3 | 8–11 (3) | 35 · 18 · 15 | 14 | 0 | 24% | 51% | 2 | ✅ ok |
| 2 | 12 | Winners stay | Same level | Wait for me | 27 | 3 | 8–10 (2) | 24.8 · 13 · 10 | 13 | 19 | 35% | 55% | 2 | ✅ ok |
| 2 | 24 | All off | Fair line | Auto | 33 | 4 | 6–7 (1) | 0 · 0 · 0 | 0 | 0 | 53% | 43% | 0 | ✅ baseline |
| 2 | 24 | All off | Fair line | Wait for me | 31 | 4 | 6–7 (1) | 0 · 0 · 0 | 0 | 22.4 | 53% | 35% | 0 | ✅ baseline |
| 2 | 24 | All off | Mixed | Auto | 31 | 6 | 5–7 (2) | 11 · 6 · 5 | 0 | 0 | 10% | 23% | 2 | ✅ ok |
| 2 | 24 | All off | Mixed | Wait for me | 29 | 7 | 5–7 (2) | 9.9 · 6 · 4 | 0 | 21.5 | 2% | 22% | 2 | ✅ ok |
| 2 | 24 | All off | Same level | Auto | 29 | 5 | 4–6 (2) | 41 · 21 · 20 | 0 | 0 | 7% | 35% | 2 | ✅ ok |
| 2 | 24 | All off | Same level | Wait for me | 27 | 5 | 4–6 (2) | 35.7 · 18 · 17 | 0 | 19.1 | 7% | 26% | 2 | ✅ ok |
| 2 | 24 | Winners stay | Fair line | Auto | 32 | 6 | 5–7 (2) | 0 · 0 · 0 | 0 | 0 | 59% | 17% | 0 | ✅ baseline |
| 2 | 24 | Winners stay | Fair line | Wait for me | 30 | 6 | 5–7 (2) | 0 · 0 · 0 | 0 | 21.4 | 57% | 17% | 0 | ✅ baseline |
| 2 | 24 | Winners stay | Mixed | Auto | 32 | 6 | 5–7 (2) | 14 · 7 · 7 | 0 | 0 | 17% | 27% | 2 | ✅ ok |
| 2 | 24 | Winners stay | Mixed | Wait for me | 31 | 7 | 4–8 (4) | 14 · 7 · 7 | 0 | 22.7 | 27% | 24% | 2 | ❌ spread 4 > Fair 2 + 1 |
| 2 | 24 | Winners stay | Same level | Auto | 29 | 5 | 4–6 (2) | 40 · 20 · 20 | 0 | 0 | 24% | 31% | 1 | ✅ ok |
| 2 | 24 | Winners stay | Same level | Wait for me | 28 | 7 | 4–7 (3) | 45.1 · 24 · 21 | 0 | 19.5 | 36% | 16% | 2 | ✅ ok |
| 2 | 40 | All off | Fair line | Auto | 33 | 8 | 3–4 (1) | 0 · 0 · 0 | 0 | 0 | 48% | 37% | 0 | ✅ baseline |
| 2 | 40 | All off | Fair line | Wait for me | 31 | 9 | 3–4 (1) | 0 · 0 · 0 | 0 | 22.7 | 52% | 47% | 0 | ✅ baseline |
| 2 | 40 | All off | Mixed | Auto | 32 | 9 | 3–4 (1) | 10 · 5 · 5 | 0 | 0 | 0% | 16% | 2 | ✅ ok |
| 2 | 40 | All off | Mixed | Wait for me | 30 | 9 | 3–4 (1) | 14 · 7 · 7 | 0 | 22 | 3% | 17% | 2 | ✅ ok |
| 2 | 40 | All off | Same level | Auto | 30 | 9 | 3–4 (1) | 45 · 23 · 22 | 0 | 0 | 20% | 23% | 2 | ✅ ok |
| 2 | 40 | All off | Same level | Wait for me | 27 | 10 | 3–3 (0) | 41 · 22 · 19 | 0 | 21.2 | 11% | 19% | 2 | ✅ ok |
| 2 | 40 | Winners stay | Fair line | Auto | 32 | 14 | 2–5 (3) | 0 · 0 · 0 | 0 | 0 | 58% | 12% | 0 | ✅ baseline |
| 2 | 40 | Winners stay | Fair line | Wait for me | 30 | 15 | 2–5 (3) | 0 · 0 · 0 | 0 | 22.8 | 55% | 11% | 0 | ✅ baseline |
| 2 | 40 | Winners stay | Mixed | Auto | 31 | 12 | 3–5 (2) | 3 · 2 · 1 | 0 | 0 | 24% | 10% | 2 | ✅ ok |
| 2 | 40 | Winners stay | Mixed | Wait for me | 31 | 11 | 3–5 (2) | 4 · 2 · 2 | 0 | 22.7 | 21% | 9% | 2 | ✅ ok |
| 2 | 40 | Winners stay | Same level | Auto | 29 | 9 | 3–4 (1) | 40 · 20 · 20 | 0 | 0 | 7% | 22% | 1 | ✅ ok |
| 2 | 40 | Winners stay | Same level | Wait for me | 28 | 12 | 2–4 (2) | 34.8 · 19 · 17 | 0 | 20.7 | 30% | 6% | 2 | ✅ ok |
| 5 | 12 | All off | Fair line | Auto | 44 | 1 | 14–17 (3) | 0 · 0 · 0 | 427 | 0 | 85% | 84% | 0 | ✅ baseline |
| 5 | 12 | All off | Fair line | Wait for me | 44 | 1 | 14–15 (1) | 0 · 0 · 0 | 159 | 268 | 85% | 84% | 0 | ✅ baseline |
| 5 | 12 | All off | Mixed | Auto | 40 | 2 | 11–15 (4) | 78 · 39 · 13 | 373 | 0 | 64% | 74% | 2 | ✅ ok |
| 5 | 12 | All off | Mixed | Wait for me | 40 | 2 | 11–15 (4) | 66.4 · 36 · 13 | 191 | 191.6 | 57% | 76% | 2 | ❌ spread 4 > Fair 1 + 1 |
| 5 | 12 | All off | Same level | Auto | 39 | 2 | 12–13 (1) | 124 · 62 · 20 | 339 | 0 | 68% | 78% | 2 | ✅ ok |
| 5 | 12 | All off | Same level | Wait for me | 40 | 2 | 12–14 (2) | 112.8 · 59 · 17 | 152 | 196.2 | 69% | 79% | 2 | ✅ ok |
| 5 | 12 | Winners stay | Fair line | Auto | 41 | 2 | 12–14 (2) | 0 · 0 · 0 | 427 | 0 | 85% | 83% | 0 | ✅ baseline |
| 5 | 12 | Winners stay | Fair line | Wait for me | 41 | 1 | 13–14 (1) | 0 · 0 · 0 | 167.3 | 259.8 | 84% | 84% | 0 | ✅ baseline |
| 5 | 12 | Winners stay | Mixed | Auto | 42 | 3 | 12–15 (3) | 40 · 20 · 6 | 399 | 0 | 67% | 76% | 2 | ✅ ok |
| 5 | 12 | Winners stay | Mixed | Wait for me | 41 | 1 | 13–14 (1) | 41.8 · 23 · 7 | 181.6 | 223.4 | 74% | 80% | 1 | ✅ ok |
| 5 | 12 | Winners stay | Same level | Auto | 38 | 1 | 12–15 (3) | 152 · 79 · 26 | 325 | 0 | 71% | 80% | 1 | ✅ ok |
| 5 | 12 | Winners stay | Same level | Wait for me | 36 | 2 | 11–13 (2) | 149.7 · 83 · 32 | 149 | 210.1 | 63% | 69% | 1 | ✅ ok |
| 5 | 24 | All off | Fair line | Auto | 73 | 3 | 12–13 (1) | 0 · 0 · 0 | 45 | 0 | 82% | 76% | 0 | ✅ baseline |
| 5 | 24 | All off | Fair line | Wait for me | 70 | 3 | 11–13 (2) | 0 · 0 · 0 | 16 | 70.6 | 81% | 79% | 0 | ✅ baseline |
| 5 | 24 | All off | Mixed | Auto | 74 | 5 | 11–14 (3) | 39 · 20 · 15 | 37 | 0 | 24% | 41% | 2 | ❌ spread 3 > Fair 1 + 1 |
| 5 | 24 | All off | Mixed | Wait for me | 72 | 3 | 11–13 (2) | 42.3 · 22 · 16 | 17 | 64.6 | 24% | 39% | 2 | ✅ ok |
| 5 | 24 | All off | Same level | Auto | 73 | 4 | 11–14 (3) | 78 · 40 · 34 | 34 | 0 | 34% | 55% | 2 | ❌ spread 3 > Fair 1 + 1 |
| 5 | 24 | All off | Same level | Wait for me | 68 | 4 | 10–14 (4) | 74.3 · 42 · 27 | 16 | 63.3 | 25% | 47% | 2 | ❌ spread 4 > Fair 2 + 1 |
| 5 | 24 | Winners stay | Fair line | Auto | 77 | 3 | 12–14 (2) | 0 · 0 · 0 | 45 | 0 | 83% | 38% | 0 | ✅ baseline |
| 5 | 24 | Winners stay | Fair line | Wait for me | 73 | 5 | 11–14 (3) | 0 · 0 · 0 | 22 | 68.7 | 82% | 42% | 0 | ✅ baseline |
| 5 | 24 | Winners stay | Mixed | Auto | 73 | 6 | 11–15 (4) | 52 · 28 · 20 | 38 | 0 | 36% | 39% | 2 | ❌ spread 4 > Fair 2 + 1 |
| 5 | 24 | Winners stay | Mixed | Wait for me | 69 | 5 | 10–14 (4) | 52.1 · 30 · 17 | 24.1 | 55.8 | 33% | 35% | 2 | ✅ ok |
| 5 | 24 | Winners stay | Same level | Auto | 68 | 6 | 10–13 (3) | 81 · 41 · 34 | 31 | 0 | 37% | 46% | 2 | ✅ ok |
| 5 | 24 | Winners stay | Same level | Wait for me | 68 | 5 | 11–13 (2) | 77 · 43 · 28 | 22.1 | 57.7 | 39% | 36% | 2 | ✅ ok |
| 5 | 40 | All off | Fair line | Auto | 82 | 5 | 7–10 (3) | 0 · 0 · 0 | 0 | 0 | 54% | 42% | 0 | ✅ baseline |
| 5 | 40 | All off | Fair line | Wait for me | 75 | 7 | 7–9 (2) | 0 · 0 · 0 | 0 | 54.9 | 55% | 36% | 0 | ✅ baseline |
| 5 | 40 | All off | Mixed | Auto | 77 | 7 | 7–9 (2) | 54 · 29 · 24 | 0 | 0 | 12% | 27% | 2 | ✅ ok |
| 5 | 40 | All off | Mixed | Wait for me | 76 | 7 | 7–9 (2) | 35.3 · 22 · 14 | 0 | 55.7 | 12% | 23% | 2 | ✅ ok |
| 5 | 40 | All off | Same level | Auto | 71 | 8 | 7–8 (1) | 93 · 49 · 44 | 0 | 0 | 14% | 34% | 2 | ✅ ok |
| 5 | 40 | All off | Same level | Wait for me | 65 | 8 | 6–8 (2) | 89.3 · 49 · 38 | 0 | 47.6 | 12% | 25% | 2 | ✅ ok |
| 5 | 40 | Winners stay | Fair line | Auto | 80 | 9 | 7–9 (2) | 0 · 0 · 0 | 0 | 0 | 54% | 19% | 0 | ✅ baseline |
| 5 | 40 | Winners stay | Fair line | Wait for me | 76 | 10 | 7–9 (2) | 0 · 0 · 0 | 0 | 55.7 | 58% | 17% | 0 | ✅ baseline |
| 5 | 40 | Winners stay | Mixed | Auto | 78 | 9 | 6–10 (4) | 35 · 19 · 16 | 0 | 0 | 24% | 15% | 2 | ❌ spread 4 > Fair 2 + 1 |
| 5 | 40 | Winners stay | Mixed | Wait for me | 73 | 10 | 6–9 (3) | 35.2 · 21 · 14 | 0 | 52.7 | 25% | 14% | 2 | ✅ ok |
| 5 | 40 | Winners stay | Same level | Auto | 72 | 7 | 6–8 (2) | 80 · 43 · 37 | 0 | 0 | 19% | 27% | 2 | ✅ ok |
| 5 | 40 | Winners stay | Same level | Wait for me | 66 | 9 | 6–8 (2) | 78 · 43 · 34 | 0 | 49.7 | 31% | 15% | 2 | ✅ ok |
