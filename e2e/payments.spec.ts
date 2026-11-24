import { expect, test, type Browser, type Page } from "@playwright/test";
import { addWalkIn, banner, court, onCourt, queue, SESSION_URL } from "./support/live";
import { signInWithNewClub } from "./support/organizer";

// "Paalalahanan" falls back to copying when there is no share sheet; read the clipboard.
test.use({ permissions: ["clipboard-read", "clipboard-write"] });

async function phone(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  return page;
}

async function checkIn(player: Page, path: string, name: string, pay: { reference?: string; cash?: boolean }) {
  await player.goto(path);
  await expect(player.getByRole("heading", { name: "Bayad · ₱150" })).toBeVisible();
  await expect(player.getByText("Kailangang bayad bago matawag.")).toBeVisible();
  await expect(player.getByText("Juan Dela Cruz")).toBeVisible();
  await player.getByLabel("Pangalan mo").fill(name);
  if (pay.reference) await player.getByLabel("GCash reference number").fill(pay.reference);
  if (pay.cash) await player.getByRole("switch", { name: "Cash ang ibabayad ko" }).check();
  await player.getByRole("button", { name: "Pumila na" }).click();
  await expect(player.getByRole("heading", { level: 1, name: `Hi, ${name}!` })).toBeVisible();
  await expect(player.locator('[data-live-sync="connected"]')).toBeVisible();
}

function paymentLine(player: Page) {
  return player.getByRole("region", { name: "Bayad" }).locator("[data-payment]");
}

test("pay first: GCash (pending) gets called, cash is held until confirmed on Bayad", async ({ page: organizer, browser }) => {
  test.setTimeout(120_000);
  await organizer.addInitScript(() => Object.defineProperty(navigator, "share", { configurable: true, value: undefined }));
  await signInWithNewClub(organizer, "payments", "Makati Picklers");

  // The club's GCash, shown to players at check-in.
  await organizer.getByRole("link", { name: "Settings ng club" }).click();
  await organizer.getByLabel("Pangalan sa GCash").fill("Juan Dela Cruz");
  await organizer.getByLabel("GCash number").fill("0917 123 4567");
  await organizer.getByRole("button", { name: "I-save" }).click();
  await expect(organizer.getByText("Na-save na.")).toBeVisible();
  await organizer.getByRole("link", { name: "Bumalik" }).click();

  // Pay-first session, ₱150 (club default), 1 court, all off.
  await organizer.getByRole("link", { name: "Bagong open play" }).click();
  await organizer.getByLabel("Pangalan ng session").fill("Pay First Night");
  await organizer.getByRole("button", { name: "Bawas" }).click();
  await organizer.getByRole("switch", { name: "Bayad muna bago pumila" }).check();
  await organizer.getByRole("button", { name: "Simulan ang session" }).click();
  await expect(organizer).toHaveURL(SESSION_URL);
  const liveUrl = organizer.url();

  // Walk-ins with each payment choice (one GCash walk-in reuses Ana's reference).
  await addWalkIn(organizer, "Cash Walk", "Beginner", { choice: "Nagbayad ng cash" });
  await addWalkIn(organizer, "GCash Walk", "Beginner", { choice: "GCash", reference: "1234-5678-90" });
  await addWalkIn(organizer, "Later Walk", "Beginner", { choice: "Mamaya na magbabayad" });
  await addWalkIn(organizer, "Cash Two", "Beginner", { choice: "Nagbayad ng cash" });

  await organizer.getByRole("link", { name: "Ipakita ang QR" }).click();
  const path = new URL((await organizer.getByText(/\/j\/[A-Z2-9]{6}$/).textContent())!).pathname;
  await organizer.goto(liveUrl);

  // Ana pays by GCash (pending); Ben will pay cash (held).
  const ana = await phone(browser);
  await checkIn(ana, path, "Phone Ana", { reference: "1234 5678 90" });
  await expect(paymentLine(ana)).toHaveText(/Hinihintay ang kumpirmasyon ng organizer/);
  const ben = await phone(browser);
  await checkIn(ben, path, "Phone Ben", { cash: true });
  await expect(paymentLine(ben)).toHaveText(/Hindi pa bayad/);
  await expect(ben.getByText("Nilalaktawan ka muna hangga't hindi bayad.")).toBeVisible();

  // Live: unpaid players show the hold; the stat links to Bayad.
  await expect(queue(organizer).getByRole("button", { name: /Later Walk/ })).toContainText("Hold · bayad muna");
  await expect(queue(organizer).getByRole("button", { name: /Phone Ben/ })).toContainText("Hold · bayad muna", { timeout: 2_000 });
  await expect(queue(organizer).getByRole("button", { name: /Phone Ana/ })).not.toContainText("Hold");

  // BR6/BR14: the call skips the unpaid (Later Walk, Ben) and takes pending Ana.
  await court(organizer, "Court 1").getByRole("button", { name: "Tawagin ang susunod" }).click();
  await expect(onCourt(organizer, "Court 1")).toHaveText(["Cash Walk", "GCash Walk", "Cash Two", "Phone Ana"]);
  await expect(ana.getByText("Ikaw na, Phone Ana!")).toBeVisible({ timeout: 2_000 });

  // Bayad screen.
  await organizer.getByRole("link", { name: /Bayad 2\/6/ }).click();
  await expect(organizer.getByRole("heading", { level: 1, name: "Bayad" })).toBeVisible();
  await expect(organizer.getByText("₱150 bawat player")).toBeVisible();
  await expect(organizer.getByText("₱300")).toBeVisible();
  await expect(organizer.getByText("sa ₱900")).toBeVisible();
  await expect(organizer.getByTestId("payment-counts")).toHaveText("2 bayad · 2 i-check · 2 hindi pa");

  const check = organizer.getByRole("region", { name: "I-check sa GCash mo (2)" });
  await expect(check.getByText("Buksan ang GCash mo at hanapin ang reference number bago pindutin ang Natanggap na.")).toBeVisible();
  // BR15: the duplicate is flagged on both, not rejected.
  await expect(check.getByText("Parehong reference kay Phone Ana")).toBeVisible();
  await expect(check.getByText("Parehong reference kay GCash Walk")).toBeVisible();
  const anaCard = check.getByRole("group", { name: "Phone Ana" });
  await expect(anaCard.getByText("•••• 7890")).toBeVisible();
  await anaCard.getByRole("button", { name: /Ipakita lahat/ }).click();
  await expect(anaCard.getByText("1234567890")).toBeVisible();
  await anaCard.getByRole("button", { name: "Natanggap na" }).click();
  await expect(organizer.getByRole("status").filter({ hasText: "Kumpirmado ang GCash ni Phone Ana." })).toBeVisible();
  await expect(paymentLine(ana)).toHaveText(/Bayad na/, { timeout: 2_000 });

  // Paalalahanan copies the reminder; then Ben's cash is received.
  const unpaid = organizer.getByRole("region", { name: /Hindi pa bayad/ });
  const benCard = unpaid.getByRole("group", { name: "Phone Ben" });
  await expect(benCard.getByText(/Naka-hold/)).toBeVisible();
  await benCard.getByRole("button", { name: "Paalalahanan" }).click();
  await expect(organizer.getByRole("status").filter({ hasText: "Nakopya ang paalala para kay Phone Ben" })).toBeVisible();
  expect(await organizer.evaluate(() => navigator.clipboard.readText())).toBe(
    "Hi Phone Ben! Paalala lang po sa bayad para sa Pay First Night: ₱150. GCash: Juan Dela Cruz 0917 123 4567. Salamat po!",
  );
  await benCard.getByRole("button", { name: "Natanggap na (cash)" }).click();
  await expect(organizer.getByRole("status").filter({ hasText: "Natanggap ang cash ni Phone Ben." })).toBeVisible();
  await expect(paymentLine(ben)).toHaveText(/Bayad na/, { timeout: 2_000 });

  // D18: "Ibalik" undoes the last "Natanggap na" (cash still chosen), then it's received again.
  await organizer.getByRole("button", { name: /^Ibalik \(\d+s\)$/ }).click();
  await expect(organizer.getByRole("status").filter({ hasText: "Naibalik sa dati ang bayad ni Phone Ben." })).toBeVisible();
  await expect(paymentLine(ben)).toHaveText(/Hindi pa bayad/, { timeout: 2_000 });
  await expect(benCard).toContainText("cash ang sabi");
  await benCard.getByRole("button", { name: "Natanggap na (cash)" }).click();
  await expect(paymentLine(ben)).toHaveText(/Bayad na/, { timeout: 2_000 });
  await expect(organizer.getByTestId("payment-counts")).toHaveText("4 bayad · 1 i-check · 1 hindi pa");

  // Undo (behind a confirm), from the collapsed "Bayad na" list.
  await organizer.getByText("Bayad na (4)").click();
  const paidCard = organizer.getByRole("group", { name: "Cash Two" });
  await paidCard.getByRole("button", { name: "Ibalik sa hindi pa bayad" }).click();
  await paidCard.getByRole("button", { name: "Oo, ibalik" }).click();
  await expect(organizer.getByRole("status").filter({ hasText: "Ibinalik sa hindi pa bayad si Cash Two." })).toBeVisible();
  await expect(organizer.getByTestId("payment-counts")).toHaveText("3 bayad · 1 i-check · 2 hindi pa");

  // Back on Live: the next call takes Ben (now paid) and still skips Later Walk.
  await organizer.getByRole("link", { name: "Bumalik" }).click();
  await court(organizer, "Court 1").getByRole("button", { name: "Tapos na · tawagin ang susunod" }).click();
  await expect(banner(organizer)).toHaveText(/Tinawag: Phone Ben, Cash Walk, GCash Walk, Phone Ana/);
  await expect(ben.getByText("Ikaw na, Phone Ben!")).toBeVisible({ timeout: 2_000 });
  await expect(queue(organizer).getByRole("button", { name: /Later Walk/ })).toContainText("Hold · bayad muna");

  await ana.context().close();
  await ben.context().close();
});

test("a free session has no payment step", async ({ page: organizer, browser }) => {
  await signInWithNewClub(organizer, "free", "Libre Club");
  await organizer.getByRole("link", { name: "Bagong open play" }).click();
  await organizer.getByLabel("Pangalan ng session").fill("Free Night");
  await organizer.getByLabel("Bayad bawat player (₱)").fill("0");
  await organizer.getByRole("button", { name: "Simulan ang session" }).click();
  await expect(organizer).toHaveURL(SESSION_URL);
  await expect(organizer.getByRole("link", { name: /Bayad/ })).toHaveCount(0);
  await organizer.getByRole("link", { name: "Walk-in" }).click();
  await expect(organizer.getByRole("heading", { level: 1, name: "Magdagdag ng walk-in" })).toBeVisible();
  await expect(organizer.getByRole("radio", { name: "Mamaya na magbabayad" })).toHaveCount(0);
  await organizer.getByRole("link", { name: "Bumalik" }).click();
  await expect(organizer).toHaveURL(SESSION_URL);

  await organizer.getByRole("link", { name: "Ipakita ang QR" }).click();
  const path = new URL((await organizer.getByText(/\/j\/[A-Z2-9]{6}$/).textContent())!).pathname;
  const player = await phone(browser);
  await player.goto(path);
  await expect(player.getByRole("button", { name: "Pumila na" })).toBeVisible();
  await expect(player.getByText(/Bayad ·/)).toHaveCount(0);
  await expect(player.getByLabel("GCash reference number")).toHaveCount(0);
  await player.getByLabel("Pangalan mo").fill("Free Fely");
  await player.getByRole("button", { name: "Pumila na" }).click();
  await expect(player.getByRole("heading", { level: 1, name: "Hi, Free Fely!" })).toBeVisible();
  await expect(player.getByRole("region", { name: "Bayad" })).toHaveCount(0);
  await player.context().close();
});
