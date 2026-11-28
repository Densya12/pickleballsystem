# Balanced teams vs Mixed: simulation (Phase 9.2b, D29)

`node scripts/simulate-open-play.mjs --presets mixed,balanced` against the local
database through the real RPCs (seed 0, auto-call). Each configuration runs the
same roster under Fair line (baseline), Mixed and Balanced teams: 2 and 5
doubles courts; 12, 24 and 40 players; All off and Winners stay; 3-hour
sessions. "Wait in line" is the minutes a player waited before each call
(every call, every player).

## Balanced teams vs Mixed

| Courts | Players | Rotation | Mixed avg · max (min) | Balanced avg · max (min) | Δ avg | Δ max | Idle, no group (min): Mixed / Balanced | Games: Mixed / Balanced |
|---|---|---|---|---|---|---|---|---|
| 2 | 12 | All off | 4.8 · 15 | 4.2 · 15 | −0.6 | 0 | 2 / 0 | 30 / 33 |
| 2 | 12 | Winners stay | 4.6 · 20 | 4.8 · 22 | +0.2 | +2 | 0 / 0 | 31 / 29 |
| 2 | 24 | All off | 17.6 · 35 | 18.2 · 40 | +0.6 | +5 | 11 / 0 | 31 / 29 |
| 2 | 24 | Winners stay | 16.7 · 40 | 16.1 · 42 | −0.6 | +2 | 14 / 0 | 32 / 32 |
| 2 | 40 | All off | 34.5 · 55 | 33 · 59 | −1.5 | +4 | 10 / 2 | 32 / 33 |
| 2 | 40 | Winners stay | 30.8 · 79 | 32.1 · 69 | +1.3 | −10 | 3 / 0 | 31 / 33 |
| 5 | 12 | All off | 1.2 · 16 | 0.6 · 12 | −0.6 | −4 | 78 / 0 | 40 / 43 |
| 5 | 12 | Winners stay | 0.9 · 16 | 0.6 · 14 | −0.3 | −2 | 40 / 0 | 42 / 43 |
| 5 | 24 | All off | 2.4 · 12 | 2.1 · 9 | −0.3 | −3 | 39 / 15 | 74 / 75 |
| 5 | 24 | Winners stay | 2.5 · 12 | 2.1 · 10 | −0.4 | −2 | 52 / 8 | 73 / 75 |
| 5 | 40 | All off | 9.2 · 20 | 8.4 · 19 | −0.8 | −1 | 54 / 0 | 77 / 80 |
| 5 | 40 | Winners stay | 8.9 · 21 | 8.5 · 24 | −0.4 | +3 | 35 / 0 | 78 / 79 |

- Average wait: Balanced teams is −1.5 to +1.3 minutes from Mixed (mean −0.3).
- Longest wait: −10 to +5 minutes from Mixed (mean −0.5). The bar (at most Mixed + 5) holds in every run.
- Courts idle for lack of a group: 0–15 minutes per session under Balanced teams vs 0–78 under Mixed; "Call mixed" was needed 10 times in total vs 113.
- Skips never exceed 2. Balanced teams repeats partners less than Fair line in every run.
- The spread bar (games per full-time player at most Fair line + 1) fails for 2 Balanced runs (2 courts · 24 · All off: 3 vs Fair 1; 5 courts · 24 · Winners stay: 4 vs Fair 2) and 3 Mixed runs, on this single seed.

## Every run

| Courts | Players | Rotation | Preset | Next game | Games | Wait in line, avg · max (min) | Longest wait (games) | Games per full-timer (spread) | Idle, no level group (min · times · Call mixed) | Idle, not enough players (min) | Idle, waiting for Call (min) | Repeat partners | Repeat opponents | Max skips | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2 | 12 | All off | Fair line | Auto | 31 | 4.7 · 13 | 1 | 10–12 (2) | 0 · 0 · 0 | 18 | 0 | 87% | 78% | 0 | ✅ baseline |
| 2 | 12 | All off | Mixed | Auto | 30 | 4.8 · 15 | 3 | 9–11 (2) | 2 · 1 · 1 | 18 | 0 | 32% | 57% | 2 | ✅ ok |
| 2 | 12 | All off | Balanced teams | Auto | 33 | 4.2 · 15 | 3 | 11–13 (2) | 0 · 0 · 0 | 18 | 0 | 47% | 59% | 2 | ✅ ok |
| 2 | 12 | Winners stay | Fair line | Auto | 31 | 4.5 · 17 | 2 | 9–12 (3) | 0 · 0 · 0 | 18 | 0 | 87% | 57% | 0 | ✅ baseline |
| 2 | 12 | Winners stay | Mixed | Auto | 31 | 4.6 · 20 | 3 | 9–12 (3) | 0 · 0 · 0 | 18 | 0 | 52% | 54% | 2 | ✅ ok |
| 2 | 12 | Winners stay | Balanced teams | Auto | 29 | 4.8 · 22 | 3 | 8–12 (4) | 0 · 0 · 0 | 18 | 0 | 52% | 48% | 2 | ✅ ok |
| 2 | 24 | All off | Fair line | Auto | 33 | 16.1 · 28 | 4 | 6–7 (1) | 0 · 0 · 0 | 0 | 0 | 53% | 43% | 0 | ✅ baseline |
| 2 | 24 | All off | Mixed | Auto | 31 | 17.6 · 35 | 6 | 5–7 (2) | 11 · 6 · 5 | 0 | 0 | 10% | 23% | 2 | ✅ ok |
| 2 | 24 | All off | Balanced teams | Auto | 29 | 18.2 · 40 | 6 | 4–7 (3) | 0 · 0 · 0 | 0 | 0 | 5% | 13% | 2 | ❌ spread 3 > Fair 1 + 1 |
| 2 | 24 | Winners stay | Fair line | Auto | 32 | 15.8 · 40 | 6 | 5–7 (2) | 0 · 0 · 0 | 0 | 0 | 59% | 17% | 0 | ✅ baseline |
| 2 | 24 | Winners stay | Mixed | Auto | 32 | 16.7 · 40 | 6 | 5–7 (2) | 14 · 7 · 7 | 0 | 0 | 17% | 27% | 2 | ✅ ok |
| 2 | 24 | Winners stay | Balanced teams | Auto | 32 | 16.1 · 42 | 7 | 5–7 (2) | 0 · 0 · 0 | 0 | 0 | 33% | 13% | 2 | ✅ ok |
| 2 | 40 | All off | Fair line | Auto | 33 | 33.4 · 52 | 8 | 3–4 (1) | 0 · 0 · 0 | 0 | 0 | 48% | 37% | 0 | ✅ baseline |
| 2 | 40 | All off | Mixed | Auto | 32 | 34.5 · 55 | 9 | 3–4 (1) | 10 · 5 · 5 | 0 | 0 | 0% | 16% | 2 | ✅ ok |
| 2 | 40 | All off | Balanced teams | Auto | 33 | 33 · 59 | 10 | 3–4 (1) | 2 · 1 · 1 | 0 | 0 | 0% | 10% | 2 | ✅ ok |
| 2 | 40 | Winners stay | Fair line | Auto | 32 | 29.3 · 84 | 14 | 2–5 (3) | 0 · 0 · 0 | 0 | 0 | 58% | 12% | 0 | ✅ baseline |
| 2 | 40 | Winners stay | Mixed | Auto | 31 | 30.8 · 79 | 12 | 3–5 (2) | 3 · 2 · 1 | 0 | 0 | 24% | 10% | 2 | ✅ ok |
| 2 | 40 | Winners stay | Balanced teams | Auto | 33 | 32.1 · 69 | 13 | 2–6 (4) | 0 · 0 · 0 | 0 | 0 | 24% | 5% | 2 | ✅ ok |
| 5 | 12 | All off | Fair line | Auto | 44 | 0.6 · 12 | 1 | 14–17 (3) | 0 · 0 · 0 | 427 | 0 | 85% | 84% | 0 | ✅ baseline |
| 5 | 12 | All off | Mixed | Auto | 40 | 1.2 · 16 | 2 | 11–15 (4) | 78 · 39 · 13 | 373 | 0 | 64% | 74% | 2 | ✅ ok |
| 5 | 12 | All off | Balanced teams | Auto | 43 | 0.6 · 12 | 2 | 14–15 (1) | 0 · 0 · 0 | 427 | 0 | 78% | 83% | 2 | ✅ ok |
| 5 | 12 | Winners stay | Fair line | Auto | 41 | 0.6 · 14 | 2 | 12–14 (2) | 0 · 0 · 0 | 427 | 0 | 85% | 83% | 0 | ✅ baseline |
| 5 | 12 | Winners stay | Mixed | Auto | 42 | 0.9 · 16 | 3 | 12–15 (3) | 40 · 20 · 6 | 399 | 0 | 67% | 76% | 2 | ✅ ok |
| 5 | 12 | Winners stay | Balanced teams | Auto | 43 | 0.6 · 14 | 2 | 13–15 (2) | 0 · 0 · 0 | 427 | 0 | 83% | 83% | 1 | ✅ ok |
| 5 | 24 | All off | Fair line | Auto | 73 | 2 · 8 | 3 | 12–13 (1) | 0 · 0 · 0 | 45 | 0 | 82% | 76% | 0 | ✅ baseline |
| 5 | 24 | All off | Mixed | Auto | 74 | 2.4 · 12 | 5 | 11–14 (3) | 39 · 20 · 15 | 37 | 0 | 24% | 41% | 2 | ❌ spread 3 > Fair 1 + 1 |
| 5 | 24 | All off | Balanced teams | Auto | 75 | 2.1 · 9 | 4 | 12–13 (1) | 15 · 8 · 6 | 43 | 0 | 23% | 39% | 2 | ✅ ok |
| 5 | 24 | Winners stay | Fair line | Auto | 77 | 1.9 · 11 | 3 | 12–14 (2) | 0 · 0 · 0 | 45 | 0 | 83% | 38% | 0 | ✅ baseline |
| 5 | 24 | Winners stay | Mixed | Auto | 73 | 2.5 · 12 | 6 | 11–15 (4) | 52 · 28 · 20 | 38 | 0 | 36% | 39% | 2 | ❌ spread 4 > Fair 2 + 1 |
| 5 | 24 | Winners stay | Balanced teams | Auto | 75 | 2.1 · 10 | 4 | 10–14 (4) | 8 · 4 · 3 | 43 | 0 | 38% | 38% | 2 | ❌ spread 4 > Fair 2 + 1 |
| 5 | 40 | All off | Fair line | Auto | 82 | 8.2 · 15 | 5 | 7–10 (3) | 0 · 0 · 0 | 0 | 0 | 54% | 42% | 0 | ✅ baseline |
| 5 | 40 | All off | Mixed | Auto | 77 | 9.2 · 20 | 7 | 7–9 (2) | 54 · 29 · 24 | 0 | 0 | 12% | 27% | 2 | ✅ ok |
| 5 | 40 | All off | Balanced teams | Auto | 80 | 8.4 · 19 | 6 | 7–9 (2) | 0 · 0 · 0 | 0 | 0 | 9% | 19% | 2 | ✅ ok |
| 5 | 40 | Winners stay | Fair line | Auto | 80 | 8.1 · 22 | 9 | 7–9 (2) | 0 · 0 · 0 | 0 | 0 | 54% | 19% | 0 | ✅ baseline |
| 5 | 40 | Winners stay | Mixed | Auto | 78 | 8.9 · 21 | 9 | 6–10 (4) | 35 · 19 · 16 | 0 | 0 | 24% | 15% | 2 | ❌ spread 4 > Fair 2 + 1 |
| 5 | 40 | Winners stay | Balanced teams | Auto | 79 | 8.5 · 24 | 9 | 7–9 (2) | 0 · 0 · 0 | 0 | 0 | 34% | 15% | 2 | ✅ ok |
