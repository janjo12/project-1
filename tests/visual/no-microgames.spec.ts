import { expect, test } from "@playwright/test";

test("attacks resolve directly and enemies still respond when attack microgames are off", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: "Singleplayer", exact: true }).click();
  await page.getByRole("button", { name: "Off", exact: true }).click();
  await page.getByRole("textbox", { name: "Seed" }).fill("testwarrior");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByTestId("class-briefing")).toBeVisible();
  await expect(page.getByText("Attack microgames are off.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByTestId("class-briefing")).toHaveCount(0);

  // The reserved test floor has a fixed single path to the first enemy.
  await page.getByRole("button", { name: /Tap right doorway to move/ }).last().click();
  await page.getByRole("button", { name: "Key", exact: true }).click();
  await page.getByRole("button", { name: /Tap left doorway to move/ }).last().click();
  await page.getByRole("button", { name: /Tap right doorway to move/ }).last().click();
  await page.getByRole("button", { name: "right locked doorway", exact: true }).click();
  await page.getByRole("button", { name: /Tap top doorway to move/ }).last().click();
  await page.getByRole("button", { name: /Tap top doorway to move/ }).last().click();
  await page.getByRole("button", { name: /Tap left doorway to move/ }).last().click();
  await page.getByRole("button", { name: /Tap bottom doorway to move/ }).last().click();

  const enemyHealth = page.getByRole("progressbar", { name: "Enemy health" });
  const playerHealth = page.getByRole("progressbar", { name: "Player health" });
  await expect(page.getByRole("button", { name: "Pixel Golem", exact: true })).toBeVisible();
  await expect(enemyHealth).toHaveAttribute("aria-valuenow", "20");
  await expect(playerHealth).toHaveAttribute("aria-valuenow", "100");

  await page.getByRole("button", { name: "Pixel Golem", exact: true }).click();
  await expect(page.getByTestId("microgame-overlay")).toHaveCount(0);
  await expect(enemyHealth).toHaveAttribute("aria-valuenow", "10", { timeout: 5000 });
  await expect(playerHealth).toHaveAttribute("aria-valuenow", "99", { timeout: 5000 });
});
