# Open Play Queue

Mobile-first web app (PWA) for running pickleball open play: queue and rotation rules for the
organizer, payment tracking, and guest check-in for players.

**Status: Phase 1 (Organizers and clubs).** Organizers sign in (Google or email magic link), create
a club, edit club settings and invite co-organizers. Club data is isolated per club with RLS.
Players never sign in.

Stack: Next.js 16 (App Router, Turbopack, Cache Components) · TypeScript · Tailwind CSS v4 ·
Supabase (Postgres, Auth, `@supabase/ssr`) · Vitest + Testing Library · Playwright · pgTAP · Vercel.

UI copy is Taglish. Code is English.

## Local setup

Requires Node 22+, npm and Docker (OrbStack or Docker Desktop) for the local Supabase stack.

```bash
npm install
npx supabase start            # local Postgres + Auth + Mailpit; applies supabase/migrations
cp .env.example .env.local    # set URL + publishable key from the `supabase start` output
npm run dev                   # http://localhost:3000
```

Use `http://localhost:3000` (not `127.0.0.1`). Auth cookies are per host, and the local auth config
redirects to `localhost`.

Magic-link emails are captured locally by Mailpit at <http://127.0.0.1:54324>. Nothing is really
sent. Google sign-in locally needs a Google OAuth client; see `[auth.external.google]` in
`supabase/config.toml`.

## Scripts

| Script              | What it does                                                               |
| ------------------- | -------------------------------------------------------------------------- |
| `npm run dev`       | Dev server                                                                 |
| `npm run lint`      | ESLint                                                                     |
| `npm run typecheck` | `next typegen` (route types), then `tsc --noEmit`                          |
| `npm run test`      | Vitest unit tests (`npm run test:watch` to watch)                          |
| `npm run test:e2e`  | Playwright e2e (Pixel 7 Chromium); builds and starts the app               |
| `npm run test:db`   | pgTAP database tests (RLS isolation, RPCs); needs `npx supabase start`     |
| `npm run db:types`  | Regenerate `src/lib/supabase/database.types.ts` from the local database    |
| `npm run build`     | Production build                                                           |

First-time e2e setup: `npx playwright install chromium`.

The signed-in e2e flows (sessions) need the local stack (`npx supabase start`): they sign in new
organizers through the real magic-link email, read from Mailpit. Playwright reuses a server already
on port 3000 (for example `npm run dev`); to test a fresh production build next to it, run
`PORT=3100 npm run test:e2e`.

If login emails arrive in English ("Your sign-in link") instead of our template, the local Auth
server lost the custom template (this can happen after `npx supabase db reset`). Run
`npx supabase stop && npx supabase start` to reload it.

CI (`.github/workflows/ci.yml`) runs two jobs on every push and pull request:
- `check`: `npm ci → lint → typecheck → test → build`
- `db`: starts a throwaway Postgres with all migrations, then runs `npm run test:db`

## Database

Migrations live in `supabase/migrations/`, and database tests in `supabase/tests/database/`.

```bash
npx supabase migration new <name>   # new migration file
npx supabase db reset               # re-apply all migrations locally (wipes local data)
npm run test:db                     # RLS + RPC tests
npm run db:types                    # refresh TypeScript types after schema changes
```

Phase 1 schema: `clubs`, `club_staff` (owner/organizer) and `club_invites` (single-use, 7-day,
32-byte URL-safe tokens), with RLS on all three. Clients can't insert or delete clubs or change staff
directly. That goes through the security-definer RPCs `create_club`, `accept_invite` and
`remove_staff`, plus the read-only `list_club_staff` and `invite_preview`.

### Cloud project

```bash
npx supabase link --project-ref <your-project-ref>   # asks for the database password
npx supabase db push                                 # applies pending migrations
```

## Environment variables

| Name                                   | Where to find it                                                  |
| -------------------------------------- | ----------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase → Project Settings → API → Project URL                   |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys → publishable key          |

`NEXT_PUBLIC_SUPABASE_ANON_KEY` (legacy anon key) is still accepted instead of the publishable key.
Never put the service role or secret key in a `NEXT_PUBLIC_` variable or in app code.
`.env.local` is git-ignored.

## Auth (decision D10)

- **Google** (primary) and **email magic link**. Until custom SMTP (Phase 7), Supabase's built-in
  email only sends to the project's team members, so the login page tells everyone else to use Google.
- `src/proxy.ts` refreshes the session on every request (`getClaims()`). It sends signed-out
  visitors to `/login?next=…`; `/login`, `/auth/*` and `/design-system` are public.
- `/auth/callback` exchanges the OAuth `code`. `/auth/confirm` verifies the magic link's
  `token_hash` (or a `code` from the default email template).
- Server code that reads the session lives in `src/lib/auth/dal.ts` and renders inside `<Suspense>`
  (Cache Components).

### Cloud auth setup

1. **Authentication → URL Configuration:** Site URL `https://<your-domain>`. Redirect URLs:
   `https://<your-domain>/**`, `http://localhost:3000/**`, and for Vercel previews
   `https://*-<your-team>.vercel.app/**`.
2. **Authentication → Emails → Magic Link** template: paste `supabase/templates/magic_link.html`.
   Its link is `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email`, which works even when the
   email is opened in another browser.
3. **Google:** see "Google sign-in" below.

### Google sign-in

1. Google Cloud Console → **Google Auth Platform**:
   - **Branding:** app name "Open Play Queue", support email, logo.
   - **Audience:** External. While in Testing, add the pilot organizers as test users, or publish the app.
   - **Data Access:** scopes `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`.
   - **Clients → Create client → Web application:**
     - Authorized JavaScript origins: `https://<your-domain>`, `http://localhost:3000`
     - Authorized redirect URIs: the callback URL shown on Supabase's Google provider page
       (`https://<project-ref>.supabase.co/auth/v1/callback`), plus
       `http://127.0.0.1:54321/auth/v1/callback` for local dev.
2. Supabase → **Authentication → Sign In / Providers → Google**: enable it and paste the Client ID and
   Client Secret.
3. Local (optional): set `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and
   `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` in your shell, set `enabled = true` under
   `[auth.external.google]` in `supabase/config.toml`, then run `npx supabase stop && npx supabase start`.

## Deploying to Vercel

1. Import the GitHub repo in Vercel (framework preset: Next.js).
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for Production and Preview.
3. Add the Vercel domain(s) to Supabase's redirect URLs and Google's JavaScript origins (see above).

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
`Input`, `RadioGroup`, `Notice`, `BackLink`, `PageShell`. All are shown at `/design-system`.

Accessibility rules every component follows:

- Body text is at least 16px. `text-sm` (14px) is the minimum, for chips and secondary hints only.
  `text-xs` is removed from the theme so it can't be used.
- Tap targets are at least 48px. Actions are tap only, never swipe-only.
- Every icon is `aria-hidden` and paired with visible text. Status is never shown by color alone.
- Text contrast is at least 4.5:1, and form-control borders at least 3:1.
