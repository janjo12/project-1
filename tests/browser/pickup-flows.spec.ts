import { expect, test } from "@playwright/test";
import { openFreshApp, startTestGame } from "./helpers";

test("picking up a floor item fills the singleplayer item slot and animates the sprite", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openFreshApp(page);
  await startTestGame(page);

  await page.getByRole("button", { name: /Tap right doorway to move/ }).last().click();
  const key = page.getByRole("button", { name: "Key", exact: true });
  await expect(key).toBeVisible();
  await expect(page.getByTestId("tutorial-get")).toBeVisible();
  const emptySlotTarget = await page.getByTestId("item-flight-target").boundingBox();
  expect(emptySlotTarget).not.toBeNull();
  await key.click();
  await expect(page.getByTestId("tutorial-get")).toBeVisible();
  const carriedItem = page.getByRole("button", { name: "Key", exact: true });
  await expect(carriedItem).toBeVisible();
  const carriedItemBounds = await page.getByTestId("item-status").boundingBox();
  expect(carriedItemBounds).not.toBeNull();
  expectWithinOnePixel(carriedItemBounds!.x + carriedItemBounds!.width / 2, emptySlotTarget!.x + emptySlotTarget!.width / 2);
  expectWithinOnePixel(carriedItemBounds!.y + carriedItemBounds!.height / 2, emptySlotTarget!.y + emptySlotTarget!.height / 2);
  await expect(page.getByTestId("sprite-flight-animation")).toBeVisible();
  const rightDoorway = page.getByRole("button", { name: /locked doorway/ }).last();
  await expect(rightDoorway).toBeEnabled();
  await rightDoorway.click();
  await expect(page.getByTestId("tutorial-get")).toHaveCount(0);
});

test("replacing a carried item drops it in the room and picks up the replacement", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openFreshApp(page);
  await startTestGame(page);

  await page.getByRole("button", { name: /Tap right doorway to move/ }).last().click();
  await page.getByRole("button", { name: "Key", exact: true }).click();
  await expect(page.getByRole("button", { name: "Key", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /locked doorway/ }).last().click();
  const meal = page.getByRole("button", { name: "Stamina Meal", exact: true });
  await expect(meal).toBeVisible();
  await meal.click();
  await expect(page.getByRole("button", { name: "Stamina Meal", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /doorway to move/ }).last().click();
  const potion = page.getByRole("button", { name: "Health Potion", exact: true });
  await expect(potion).toBeVisible();
  await potion.click();
  await expect(page.getByRole("button", { name: "Health Potion", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Stamina Meal", exact: true })).toBeVisible();
});

function expectWithinOnePixel(actual: number, expected: number) {
  expect(Math.abs(actual - expected), `${actual} should align with ${expected}`).toBeLessThanOrEqual(1);
}
