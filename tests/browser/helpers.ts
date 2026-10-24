import { expect, type Page } from "@playwright/test";

export async function openFreshApp(page: Page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Singleplayer" })).toBeVisible();
}

export async function startTestGame(page: Page, seed = "testwarrior") {
  await page.getByRole("button", { name: "Singleplayer" }).click();
  await page.getByRole("textbox", { name: "Seed" }).fill(seed);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  const nextInstructions = page.getByRole("button", { name: "Next class instructions" });
  if (await nextInstructions.isVisible().catch(() => false)) {
    await nextInstructions.click();
    await page.getByRole("button", { name: "Start playing" }).click();
  }
  await expect(page.getByRole("button", { name: "Menu" })).toBeVisible();
}
