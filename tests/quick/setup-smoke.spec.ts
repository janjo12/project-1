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
