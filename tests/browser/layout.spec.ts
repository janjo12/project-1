import { expect, test } from "@playwright/test";
import { openFreshApp, startTestGame } from "./helpers";

for (const viewport of [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 900 },
]) {
  test(`${viewport.name} gameplay and pause menu fit the viewport`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openFreshApp(page);
    await startTestGame(page);

    await expect(page.getByText("Find the Stairs to Reach the Next Level")).toBeVisible();
    await expect(page.getByTestId("tutorial-you-are-here")).toBeVisible();
    await expect(page.getByTestId("tutorial-move").first()).toBeVisible();
    expect(await page.getByTestId("tutorial-move").count()).toBeGreaterThan(0);
    await page.getByRole("button", { name: /Tap right doorway to move/ }).last().click();
    await expect(page.getByTestId("tutorial-move")).toHaveCount(0);
    await expect(page.getByTestId("tutorial-you-are-here")).toBeVisible();

    const viewportBounds = { width: viewport.width, height: viewport.height };
    const gameBounds = await page.getByTestId("dungeon-room-frame").boundingBox();
    expect(gameBounds).not.toBeNull();
    expect(gameBounds!.x).toBeGreaterThanOrEqual(0);
    expect(gameBounds!.y).toBeGreaterThanOrEqual(0);
    expect(gameBounds!.x + gameBounds!.width).toBeLessThanOrEqual(viewportBounds.width + 1);
    expect(gameBounds!.y + gameBounds!.height).toBeLessThanOrEqual(viewportBounds.height + 1);

    await page.getByRole("button", { name: "Menu" }).click();
    const menu = page.getByRole("dialog", { name: "Game menu" });
    await expect(menu).toBeVisible();
    const menuBounds = await menu.boundingBox();
    expect(menuBounds).not.toBeNull();
    expect(menuBounds!.x).toBeGreaterThanOrEqual(0);
    expect(menuBounds!.y).toBeGreaterThanOrEqual(0);
    expect(menuBounds!.x + menuBounds!.width).toBeLessThanOrEqual(viewportBounds.width + 1);
    expect(menuBounds!.y + menuBounds!.height).toBeLessThanOrEqual(viewportBounds.height + 1);
  });
}
