# Open Play Queue

Mobile-first web app (PWA) for running pickleball open play: queue and rotation rules for the
organizer, payment tracking, and guest check-in for players.

**Status: Phase 0 (Foundation).** Project setup, the "Ink & Lime" design system, Supabase
wiring, tests and CI. No features yet.

Stack: Next.js 16 (App Router, Turbopack, Cache Components) · TypeScript · Tailwind CSS v4 ·
Supabase (`@supabase/ssr`) · Vitest + Testing Library · Playwright · Vercel.

UI copy is Taglish. Code is English.

## Setup

Requires Node 22+ and npm.

```bash
npm install
cp .env.example .env.local   # then fill in the values (see Supabase below)
npm run dev                  # http://localhost:3000
```

The component sheet is at <http://localhost:3000/design-system>.

## Scripts

| Script              | What it does                                                          |
| ------------------- | --------------------------------------------------------------------- |
| `npm run dev`       | Dev server                                                            |
| `npm run lint`      | ESLint (Next.js core-web-vitals + TypeScript rules)                   |
| `npm run typecheck` | `next typegen` (route types like `LayoutProps`), then `tsc --noEmit`  |
| `npm run test`      | Vitest unit tests, single run (`npm run test:watch` to watch)         |
| `npm run test:e2e`  | Playwright e2e on a Pixel 7 Chromium viewport; builds and starts the app |
| `npm run build`     | Production build                                                      |

First-time e2e setup: `npx playwright install chromium`.

CI (`.github/workflows/ci.yml`) runs `npm ci → lint → typecheck → test → build` on every push and
pull request. E2E is not in CI yet.

## Environment variables

| Name                            | Where to find it                                      |
| ------------------------------- | ----------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase → Project Settings → API → Project URL       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys → anon (legacy) or publishable key |

Both are public (they ship to the browser). Never put the `service_role` / secret key in a
`NEXT_PUBLIC_` variable. `.env.local` is git-ignored; only `.env.example` is committed.

## Supabase

Clients live in `src/lib/supabase/`:

- `client.ts`: `createClient()` for Client Components (browser).
- `server.ts`: `await createClient()` for Server Components, Server Functions and Route Handlers
  (cookie-based). With Cache Components on, reading cookies is request-time work, so wrap the
  component that calls it in `<Suspense>`.

Both throw a clear error if the env vars are missing. Nothing calls them yet, so the app builds
without env vars.

Migrations will live in `supabase/` (Supabase CLI). To set it up:

```bash
brew install supabase/tap/supabase   # or: npx supabase <command>
supabase init                        # creates supabase/config.toml
supabase link --project-ref <your-project-ref>
```

Session refresh via a Next.js `proxy.ts` (formerly middleware) gets added with auth, in a later phase.

## Deploying to Vercel

1. Import the GitHub repo in Vercel (the framework preset is detected as Next.js).
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` under Project → Settings →
   Environment Variables, for Production and Preview.
3. Deploy. Each pull request gets a preview URL.

## Design system ("Ink & Lime")

Tokens are in `src/app/globals.css` (`@theme`). Colors use Tailwind v4's per-utility namespaces, so
each token creates only the utility it is meant for:

- Backgrounds: `bg-page`, `bg-surface`, `bg-subtle`, `bg-primary`, `bg-primary-tint`, `bg-accent`,
  `bg-accent-soft`, `bg-success`, `bg-warn`
- Text: `text-ink`, `text-muted`, `text-placeholder`, `text-on-primary`, `text-on-accent-soft`,
  `text-success`, `text-warn`, `text-danger`
- Borders: `border-default`, `border-strong` (form controls), `border-ink`, `border-accent`,
  `border-danger`
- Shape and type: `rounded-card`, `rounded-control`, `shadow-card`, `max-w-app` (430px), `font-display`
  (Space Grotesk), `text-body` (17px)

Components (`src/components/ui/`, import from `@/components/ui`): `Button`, `StatusLabel`, `Card`,
`Input`, `BackLink`, `PageShell`.

Accessibility rules every component follows:

- Body text is at least 16px. `text-sm` (14px) is the minimum, for chips and secondary hints only.
  `text-xs` is removed from the theme so it can't be used.
- Tap targets are at least 48px.
- Every icon is `aria-hidden` and paired with visible text. Status is never shown by color alone.
- Text contrast is at least 4.5:1, and form-control borders at least 3:1.
