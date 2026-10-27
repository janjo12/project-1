import { expect, test } from "@playwright/test";

import { openFreshApp, startTestGame } from "./helpers";

test("room frame gaps align with visible doorways without a game-view guard marker", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 1000 });
  await openFreshApp(page);
  await startTestGame(page, "testwarrior");
  await page.getByRole("button", { name: /Tap right doorway to move/ }).last().click();
  await page.getByRole("button", { name: "Key", exact: true }).click();
  await page.getByRole("button", { name: /Tap left doorway to move/ }).last().click();
  await page.getByRole("button", { name: /Tap right doorway to move/ }).last().click();
  await page.getByRole("button", { name: /locked doorway/ }).last().click();
  await page.getByRole("button", { name: /Tap left doorway to move/ }).last().click();
  await page.getByRole("button", { name: /Tap left doorway to move/ }).last().click();
  await page.getByRole("button", { name: /Tap bottom doorway to move/ }).last().click();

  const frame = page.getByTestId("dungeon-room-frame");
  const frameBounds = await frame.boundingBox();
  expect(frameBounds).not.toBeNull();

  const doorwayButtons = page.getByRole("button", { name: /doorway/ });
  const doorwayCount = await doorwayButtons.count();
  expect(doorwayCount).toBeGreaterThan(0);
  expect(await page.getByTestId(/^room-frame-gap-/).count()).toBe(doorwayCount);

  for (let index = 0; index < doorwayCount; index += 1) {
    const doorway = doorwayButtons.nth(index);
    const label = await doorway.getAttribute("aria-label");
    const direction = label?.match(/^(?:Tap )?(top|right|bottom|left)/)?.[1];
    expect(direction).toBeTruthy();

    const gap = page.getByTestId(`room-frame-gap-${direction}`);
    const gapBounds = await gap.boundingBox();
    const doorwayBounds = await doorway.boundingBox();
    expect(gapBounds).not.toBeNull();
    expect(doorwayBounds).not.toBeNull();
    if (direction === "top" || direction === "bottom") {
      expectWithinOnePixel(gapBounds!.x + gapBounds!.width / 2, frameBounds!.x + frameBounds!.width / 2);
      expectWithinOnePixel(gapBounds!.x + gapBounds!.width / 2, doorwayBounds!.x + doorwayBounds!.width / 2);
      if (direction === "top") expectWithinOnePixel(gapBounds!.y, frameBounds!.y);
      else expectWithinOnePixel(gapBounds!.y + gapBounds!.height, frameBounds!.y + frameBounds!.height);
    } else {
      expectWithinOnePixel(gapBounds!.y + gapBounds!.height / 2, frameBounds!.y + frameBounds!.height / 2);
      expectWithinOnePixel(gapBounds!.y + gapBounds!.height / 2, doorwayBounds!.y + doorwayBounds!.height / 2);
      if (direction === "left") expectWithinOnePixel(gapBounds!.x, frameBounds!.x);
      else expectWithinOnePixel(gapBounds!.x + gapBounds!.width, frameBounds!.x + frameBounds!.width);
    }
  }

  const guardedDoorway = page.getByRole("button", { name: /guarded doorway/ }).first();
  await expect(guardedDoorway).toBeVisible();
  await expect(guardedDoorway).not.toContainText("×");
});

function expectWithinOnePixel(actual: number, expected: number) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1);
}
