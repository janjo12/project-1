import { expect, test } from "@playwright/test";

test("web setup controls and help remain reachable", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Singleplayer" })).toBeVisible();
  await page.getByRole("button", { name: "Singleplayer" }).click();
  await expect(page.getByRole("button", { name: "Start", exact: true })).toBeVisible();
  await expect(page.getByText("Attack microgames", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Difficulty help" }).click();
  await expect(page.getByRole("dialog", { name: "Difficulty help" })).toBeVisible();
  await page.getByRole("button", { name: "Got it" }).click();

  expect(pageErrors).toEqual([]);
});

test("a new singleplayer run reaches gameplay with default microgame settings", async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  await expect(page.getByRole("button", { name: "Singleplayer" })).toBeVisible();
  await page.getByRole("button", { name: "Singleplayer" }).click();
  await expect(page.getByRole("switch", { name: "Attack microgames" })).toBeChecked();
  await page.getByRole("textbox", { name: "Seed" }).fill("testwarrior");
  await page.getByRole("button", { name: "Start", exact: true }).click();

  const briefing = page.getByTestId("class-briefing");
  await expect(briefing).toBeVisible();
  await expect(page.getByRole("button", { name: "Next class instructions", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next class instructions", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start playing", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start playing", exact: true }).click();
  await expect(page.getByRole("button", { name: "Menu" })).toBeVisible();
  await expect(briefing).toHaveCount(0);
});
