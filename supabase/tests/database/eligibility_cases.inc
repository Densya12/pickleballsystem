-- Shared eligibility fixture (BR6 + BR14). ONE list of cases, read by:
--   supabase/tests/database/13_payments.test.sql  (\ir; checks private.eligible_players)
--   src/lib/player/eligibility.test.ts            (checks isCallable() in the app)
-- Both must give the same answer for every case. The .inc extension keeps
-- `supabase test db` from running this file on its own.
select set_config('test.eligibility_cases', $cases$[
  {"status": "queued", "payment": "unpaid", "payFirst": false, "fee": 150, "eligible": true},
  {"status": "queued", "payment": "pending", "payFirst": false, "fee": 150, "eligible": true},
  {"status": "queued", "payment": "confirmed", "payFirst": false, "fee": 150, "eligible": true},
  {"status": "paused", "payment": "unpaid", "payFirst": false, "fee": 150, "eligible": false},
  {"status": "paused", "payment": "pending", "payFirst": false, "fee": 150, "eligible": false},
  {"status": "paused", "payment": "confirmed", "payFirst": false, "fee": 150, "eligible": false},
  {"status": "playing", "payment": "unpaid", "payFirst": false, "fee": 150, "eligible": false},
  {"status": "playing", "payment": "pending", "payFirst": false, "fee": 150, "eligible": false},
  {"status": "playing", "payment": "confirmed", "payFirst": false, "fee": 150, "eligible": false},
  {"status": "left", "payment": "unpaid", "payFirst": false, "fee": 150, "eligible": false},
  {"status": "left", "payment": "pending", "payFirst": false, "fee": 150, "eligible": false},
  {"status": "left", "payment": "confirmed", "payFirst": false, "fee": 150, "eligible": false},
  {"status": "queued", "payment": "unpaid", "payFirst": true, "fee": 150, "eligible": false},
  {"status": "queued", "payment": "pending", "payFirst": true, "fee": 150, "eligible": true},
  {"status": "queued", "payment": "confirmed", "payFirst": true, "fee": 150, "eligible": true},
  {"status": "paused", "payment": "unpaid", "payFirst": true, "fee": 150, "eligible": false},
  {"status": "paused", "payment": "pending", "payFirst": true, "fee": 150, "eligible": false},
  {"status": "paused", "payment": "confirmed", "payFirst": true, "fee": 150, "eligible": false},
  {"status": "playing", "payment": "unpaid", "payFirst": true, "fee": 150, "eligible": false},
  {"status": "playing", "payment": "pending", "payFirst": true, "fee": 150, "eligible": false},
  {"status": "playing", "payment": "confirmed", "payFirst": true, "fee": 150, "eligible": false},
  {"status": "left", "payment": "unpaid", "payFirst": true, "fee": 150, "eligible": false},
  {"status": "left", "payment": "pending", "payFirst": true, "fee": 150, "eligible": false},
  {"status": "left", "payment": "confirmed", "payFirst": true, "fee": 150, "eligible": false},
  {"status": "queued", "payment": "unpaid", "payFirst": true, "fee": 0, "eligible": true},
  {"status": "queued", "payment": "pending", "payFirst": true, "fee": 0, "eligible": true},
  {"status": "queued", "payment": "confirmed", "payFirst": true, "fee": 0, "eligible": true},
  {"status": "paused", "payment": "unpaid", "payFirst": true, "fee": 0, "eligible": false},
  {"status": "paused", "payment": "pending", "payFirst": true, "fee": 0, "eligible": false},
  {"status": "paused", "payment": "confirmed", "payFirst": true, "fee": 0, "eligible": false},
  {"status": "playing", "payment": "unpaid", "payFirst": true, "fee": 0, "eligible": false},
  {"status": "playing", "payment": "pending", "payFirst": true, "fee": 0, "eligible": false},
  {"status": "playing", "payment": "confirmed", "payFirst": true, "fee": 0, "eligible": false},
  {"status": "left", "payment": "unpaid", "payFirst": true, "fee": 0, "eligible": false},
  {"status": "left", "payment": "pending", "payFirst": true, "fee": 0, "eligible": false},
  {"status": "left", "payment": "confirmed", "payFirst": true, "fee": 0, "eligible": false}
]$cases$, true);
