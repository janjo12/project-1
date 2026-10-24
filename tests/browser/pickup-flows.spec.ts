import { expect, test } from "@playwright/test";
import { openFreshApp, startTestGame } from "./helpers";

test("picking up a floor item fills the singleplayer item slot and animates the sprite", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openFreshApp(page);
  await startTestGame(page);

  await page.getByRole("button", { name: /Tap right doorway to move/ }).last().click();
  const key = page.getByRole("button", { name: "Key", exact: true });
  await expect(key).toBeVisible();
  await key.click();
  await expect(page.getByRole("button", { name: "Key. Drop item" })).toBeVisible();
  await expect(page.getByTestId("sprite-flight-animation")).toBeVisible();
});

test("replacing a carried item drops it in the room and picks up the replacement", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openFreshApp(page);
  await startTestGame(page);

  await page.getByRole("button", { name: /Tap right doorway to move/ }).last().click();
  await page.getByRole("button", { name: "Key", exact: true }).click();
  await expect(page.getByRole("button", { name: "Key. Drop item" })).toBeVisible();
  await page.getByRole("button", { name: /locked doorway/ }).last().click();
  const meal = page.getByRole("button", { name: "Stamina Meal", exact: true });
  await expect(meal).toBeVisible();
  await meal.click();
  await expect(page.getByRole("button", { name: "Stamina Meal. Drop item" })).toBeVisible();
  await page.getByRole("button", { name: /doorway to move/ }).last().click();
  const potion = page.getByRole("button", { name: "Health Potion", exact: true });
  await expect(potion).toBeVisible();
  await potion.click();
  await expect(page.getByRole("button", { name: "Health Potion. Drop item" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Stamina Meal", exact: true })).toBeVisible();
});
