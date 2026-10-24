import type { Page } from "@playwright/test";

export async function openScenarioApp(page: Page, resetStorage = false) {
  if (resetStorage) await page.addInitScript(() => localStorage.clear());
  await page.goto("/", { waitUntil: "domcontentloaded" });
}
