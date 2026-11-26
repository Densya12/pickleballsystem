@AGENTS.md

# Pilaball: project rules

Pilaball (D21) is a mobile-first PWA for running pickleball open play (organizer queue + rotation,
payment tracking, guest check-in). UI copy is English by default with Taglish as the second language
(D20); code is English.

## Spec and phases

- Source of truth: the **Build Spec** (first titled "Pickleball Open Play Queue — Build Spec"):
  decisions **D1–D24**, business rules **BR1–BR21**, non-functional rules **NF1–NF14**. Cite the IDs
  when a change implements or touches one.
- Build **one phase at a time**. Don't start the next phase's features, tables or screens early.
- Phase 0 (Foundation): design system, base components, Supabase wiring, tests, CI.
- Phase 1 (Organizers and clubs): Google + magic-link sign-in, clubs/club_staff/club_invites with
  RLS, settings, co-organizer invites.

## Brand (D21)

- Name: **Pilaball**, from `APP_NAME` in `src/lib/brand.ts`. Never type the name in UI or metadata;
  page titles get " · Pilaball" from the layout's title template. The repo, the npm package and the
  database keep their old names.
- Mark: `src/components/brand/BrandMark.tsx` (option A, "the player": an ink #111412 rounded tile,
  a white stem, a lime #C9F26B ball for a head). The favicon is `src/app/icon.svg`; the PNG icons
  come from `node scripts/generate-icons.mjs`.
- Wordmark: `src/components/brand/Wordmark.tsx`, lowercase "pilaball" in Space Grotesk 600 with a
  dotless ı whose dot is the ball (outlined in ink on light backgrounds). Its accessible name is
  "Pilaball". Space Grotesk loads the latin-ext subset for the ı.
- Use ™, not ®, until the name is registered.

## Definition of done (every phase)

These must pass before saying a phase is done. Report the exact result of each:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e   # also required whenever a UI flow changes
npm run test:db    # also required whenever supabase/migrations changes (needs `npx supabase start`)
```

Schema changes: add a new migration (never edit one already pushed to the cloud project), add
pgTAP tests for its RLS in `supabase/tests/database/`, then `npm run db:types`. Show Kenji the SQL
before `npx supabase db push`.

Fix failures; don't skip or weaken tests to make them pass.

## UI rules (v5 "Clean 2026", D19)

Source of truth for the look: `docs/design/v5/`.

- Type: one scale, as tokens in `src/app/globals.css`. Inter for text: `text-body` 15px (body),
  `text-sm` 13px (secondary lines, chips), `text-xs` 12px (captions, tab labels); `text-lg` 17,
  `text-xl` 20. Space Grotesk (`font-display`) for titles: `text-2xl` 28, `text-3xl` 30. Display
  sizes only for big numbers: `text-display-court` (court on You're up), `text-display-number`
  (place in line). Tailwind's default sizes are switched off, so no other size exists; don't add
  one-off `text-[..px]` sizes.
- Buttons: compact buttons 36–40px tall with a 44×44 touch area (`touch-target`); the main button
  50–54px, and only **one main button per screen**. Icon-only buttons are round, 36–40px, with an
  `aria-label`.
- Cards: radius 18–20px, no borders and no boxes inside boxes; separate rows with hairline dividers.
- Navigation: floating pill tab bars: **Home · Members · Settings**, and inside a live session
  **Courts · Queue · Payments · More** (More is a sheet). Sub-pages use the `BackLink` with the
  parent's name, e.g. **"‹ Home"**.
- Status words, one per state, everywhere (chip with words, never color alone): **Unpaid, Resting,
  Not ready, To check, Paid, Received** (Taglish: Bayad muna, Pahinga, Hindi pa handa, I-check,
  Bayad na, Natanggap).
- Every icon is paired with words (icons are `aria-hidden`); never color alone for status.
- Contrast: text ≥4.5:1; form-field borders and other UI boundaries ≥3:1 (`border-field`).
- First loads show a skeleton, never a spinner: the page's `<Suspense>` fallback is the real shell
  with `Skeleton*` blocks from `src/components/ui/Skeleton.tsx` mirroring the screen's layout (see
  `src/components/skeletons/`). Refetches keep the current content.
- Tap only: no swipe-only actions. Every action needs a visible button.
- Use the tokens in `src/app/globals.css` and the components in `src/components/ui/` before adding
  new ones. No extra UI libraries.

## Language (D20)

- English is the default; Taglish is second. The choice is per device (cookie): Settings › Language
  for organizers, the EN | TL switch for players. `<html lang>` and Tagatawag follow it.
- Every user-facing string lives in the typed dictionaries in `src/lib/i18n/dict/` (`en` and `fil`
  with the same keys). Add each new string to **both**; a missing key fails typecheck and the
  parity test (`src/lib/i18n/dictionary.test.ts`).
- Server code uses `getT()` from `@/lib/i18n/server`; client code uses `useT()` from
  `@/lib/i18n/client`.

## Next.js 16 + Supabase

- Next.js 16 with `cacheComponents: true`. Read the bundled docs in `node_modules/next/dist/docs/`
  before using an API you're unsure about.
- Server code that reads Supabase cookies (`createClient` from `@/lib/supabase/server`) must render
  inside `<Suspense>`, or the route can't be prerendered.
- Browser code uses `@/lib/supabase/client`.
- Read the session through `@/lib/auth/dal` (`getClaims()`-based), never `getSession()` on the server.
- Every Server Action re-checks auth and role itself; RLS is the final guard.

## Git and secrets

- **Never commit or push unless Kenji asks for it in that prompt.** Asking in an earlier prompt
  doesn't carry over.
- Never commit `.env.local` or any secret (service-role keys, tokens). Only `.env.example` is
  tracked, with placeholder values.
