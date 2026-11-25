-- Shared display-name fixture (QA-07). ONE list of cases, read by:
--   supabase/tests/database/21_qa07_names.test.sql  (\ir; private.clean_display_name / display_name_ok)
--   src/lib/names.test.ts                          (cleanDisplayName / isDisplayNameOk in the app)
-- Both must give the same answer. Inputs use JSON \u escapes for invisible characters.
-- "ok": 2-40 characters after cleaning and at least one visible letter or number.
select set_config('test.name_cases', $cases$[
  {"input": "Ana", "cleaned": "Ana", "ok": true},
  {"input": "  Mark   Santos ", "cleaned": "Mark Santos", "ok": true},
  {"input": "​​​", "cleaned": "", "ok": false},
  {"input": "Ana‮abc 2", "cleaned": "Anaabc 2", "ok": true},
  {"input": "⁦Ben⁩", "cleaned": "Ben", "ok": true},
  {"input": "﻿Carlo", "cleaned": "Carlo", "ok": true},
  {"input": "A​n‌a", "cleaned": "Ana", "ok": true},
  {"input": "‎‏--", "cleaned": "--", "ok": false},
  {"input": "‪‫‬‭", "cleaned": "", "ok": false},
  {"input": "مريم 🏓", "cleaned": "مريم 🏓", "ok": true},
  {"input": "🏓🏓", "cleaned": "🏓🏓", "ok": false},
  {"input": "...", "cleaned": "...", "ok": false},
  {"input": "李明", "cleaned": "李明", "ok": true},
  {"input": "Ñiño", "cleaned": "Ñiño", "ok": true},
  {"input": "07", "cleaned": "07", "ok": true},
  {"input": "A", "cleaned": "A", "ok": false},
  {"input": "<b>Ana</b>", "cleaned": "<b>Ana</b>", "ok": true},
  {"input": "Bad\nName\t", "cleaned": "Bad Name", "ok": true},
  {"input": "Maximiliano Bartholomew Dela Cruz-Santos", "cleaned": "Maximiliano Bartholomew Dela Cruz-Santos", "ok": true},
  {"input": "Maximiliano Bartholomew Dela Cruz-Santos Jr", "cleaned": "Maximiliano Bartholomew Dela Cruz-Santos Jr", "ok": false}
]$cases$, true);
