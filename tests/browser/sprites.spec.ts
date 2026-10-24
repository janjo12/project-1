import { expect, test } from "@playwright/test";
import { openFreshApp, startTestGame } from "./helpers";

test("the gameplay room renders loaded atlas sprites", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 900 });
  await openFreshApp(page);
  await startTestGame(page);

  const playerSprite = page.getByTestId("local-player-actor").getByTestId("pixel-sprite-image");
  await expect(playerSprite).toBeVisible();
  await expect.poll(() => playerSprite.locator("img").evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByText(/\[(?:warrior_graphic|pixel_golem_graphic)\]/)).toHaveCount(0);
});
