import { expect, type Page } from "@playwright/test";

/**
 * Signed-in e2e flows use the local Supabase stack (`npx supabase start`).
 * Sign-in goes through the real magic-link flow: the link is read from the
 * local Mailpit inbox, so no service-role key or test-only route is needed.
 */
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

export async function magicLinkFor(email: string): Promise<string> {
  const query = encodeURIComponent(`to:"${email}"`);
  let link: string | undefined;
  await expect
    .poll(
      async () => {
        const search = await fetch(`${MAILPIT_URL}/api/v1/search?query=${query}&limit=1`);
        const { messages } = (await search.json()) as { messages: { ID: string }[] };
        if (!messages?.length) return undefined;
        const message = await fetch(`${MAILPIT_URL}/api/v1/message/${messages[0].ID}`);
        const { HTML } = (await message.json()) as { HTML: string };
        link = /href="([^"]*token_hash=[^"]*)"/.exec(HTML)?.[1]?.replaceAll("&amp;", "&");
        return link;
      },
      { message: `magic link email for ${email} (is the local stack running?)`, timeout: 15_000 },
    )
    .toBeTruthy();
  return link!;
}

/** Signs in a new organizer with an email magic link. Ends on /club/new. */
export async function signInNewOrganizer(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  // D22: Google is the main action; email is one tap away.
  await page.getByRole("button", { name: "Use email instead" }).click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await expect(page.getByText(email, { exact: true })).toBeVisible();

  await page.goto(await magicLinkFor(email));
  await expect(page).toHaveURL(/\/club\/new$/);
}

/** New organizer with a new club. Ends on Home. */
export async function signInWithNewClub(page: Page, prefix: string, clubName: string): Promise<void> {
  await signInNewOrganizer(page, uniqueEmail(prefix));
  await page.getByLabel("Club name").fill(clubName);
  await page.getByRole("button", { name: "Create club" }).click();
  await expect(page.getByRole("heading", { level: 1, name: clubName })).toBeVisible();
}
