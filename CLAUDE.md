@AGENTS.md

# Open Play Queue: project rules

Mobile-first PWA for running pickleball open play (organizer queue + rotation, payment tracking,
guest check-in). UI copy is Taglish; code is English.

## Spec and phases

- Source of truth: **"Pickleball Open Play Queue — Build Spec"**: decisions **D1–D14**, business
  rules **BR1–BR21**, non-functional rules **NF1–NF14**. Cite the IDs when a change implements or
  touches one.
- Build **one phase at a time**. Don't start the next phase's features, tables or screens early.
- Phase 0 (Foundation) is done: design system, base components, Supabase wiring, tests, CI.

## Definition of done (every phase)

These must pass before saying a phase is done. Report the exact result of each:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e   # also required whenever a UI flow changes
```

Fix failures; don't skip or weaken tests to make them pass.

## UI rules

- Body text ≥16px. `text-sm` (14px) only for chips and secondary hints. `text-xs` is removed.
- Tap targets ≥48px.
- Every icon is paired with words (icons are `aria-hidden`); never color alone for status.
- Text contrast ≥4.5:1 (form-control borders ≥3:1).
- Sub-pages use the labelled **"Bumalik"** back link (`BackLink`).
- Tap only: no swipe-only actions. Every action needs a visible button.
- Use the tokens in `src/app/globals.css` and the components in `src/components/ui/` before adding
  new ones. No extra UI libraries.

## Next.js 16 + Supabase

- Next.js 16 with `cacheComponents: true`. Read the bundled docs in `node_modules/next/dist/docs/`
  before using an API you're unsure about.
- Server code that reads Supabase cookies (`createClient` from `@/lib/supabase/server`) must render
  inside `<Suspense>`, or the route can't be prerendered.
- Browser code uses `@/lib/supabase/client`.

## Git and secrets

- **Never commit or push unless Kenji asks for it in that prompt.** Asking in an earlier prompt
  doesn't carry over.
- Never commit `.env.local` or any secret (service-role keys, tokens). Only `.env.example` is
  tracked, with placeholder values.
