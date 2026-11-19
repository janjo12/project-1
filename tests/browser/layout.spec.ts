import { expect, test } from "@playwright/test";
import { openFreshApp, startTestGame } from "./helpers";

for (const viewport of [
  { name: "compact phone", width: 320, height: 568 },
  { name: "phone", width: 390, height: 844 },
  { name: "large phone", width: 430, height: 932 },
  { name: "phone landscape", width: 844, height: 390 },
  { name: "small tablet", width: 768, height: 1024 },
  { name: "tablet landscape", width: 1024, height: 768 },
  { name: "small laptop", width: 1024, height: 768 },
  { name: "desktop", width: 1280, height: 900 },
  { name: "large desktop", width: 1920, height: 1080 },
]) {
  test(`${viewport.name} gameplay and pause menu fit the viewport`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openFreshApp(page);
    await startTestGame(page);

    await expect(page.getByText("Find the Stairs to Reach the Next Level")).toBeVisible();
    const showsMap = viewport.height >= 500 && viewport.width <= 430;
    if (showsMap) await expect(page.getByTestId("tutorial-you-are-here")).toBeVisible();
    await expect(page.getByTestId("tutorial-move").first()).toBeVisible();
    expect(await page.getByTestId("tutorial-move").count()).toBeGreaterThan(0);
    const currentRoom = page.getByTestId("current-dungeon-room");
    let previousRoom = await currentRoom.getAttribute("aria-label");
    await page.getByRole("button", { name: /Tap right doorway to move/ }).last().click();
    await expect.poll(() => currentRoom.getAttribute("aria-label")).not.toBe(previousRoom);
    await expect(page.getByTestId("tutorial-move")).toHaveCount(0);
    if (showsMap) await expect(page.getByTestId("tutorial-you-are-here")).toBeVisible();
    previousRoom = await currentRoom.getAttribute("aria-label");
    await page.getByRole("button", { name: /Tap left doorway to move/ }).last().click();
    await expect.poll(() => currentRoom.getAttribute("aria-label")).not.toBe(previousRoom);
    await expect(page.getByRole("button", { name: /Tap right doorway to move/ }).last()).toBeVisible();
    await expect(page.getByTestId("tutorial-move")).toHaveCount(0);
    if (showsMap) await expect(page.getByTestId("tutorial-you-are-here")).toBeVisible();
    previousRoom = await currentRoom.getAttribute("aria-label");
    await page.getByRole("button", { name: /Tap right doorway to move/ }).last().click();
    await expect.poll(() => currentRoom.getAttribute("aria-label")).not.toBe(previousRoom);
    if (showsMap) await expect(page.getByTestId("tutorial-you-are-here")).toHaveCount(0);

    const viewportBounds = { width: viewport.width, height: viewport.height };
    const gameBounds = await page.getByTestId("dungeon-room-frame").boundingBox();
    const playerBounds = await page.getByTestId("player-sprite-envelope").boundingBox();
    expect(gameBounds).not.toBeNull();
    expect(gameBounds!.x).toBeGreaterThanOrEqual(0);
    expect(gameBounds!.y).toBeGreaterThanOrEqual(0);
    expect(gameBounds!.x + gameBounds!.width).toBeLessThanOrEqual(viewportBounds.width + 1);
    expect(gameBounds!.y + gameBounds!.height).toBeLessThanOrEqual(viewportBounds.height + 1);
    expect(playerBounds).not.toBeNull();
    console.log(`${viewport.name} ${viewport.width}x${viewport.height}: room=${Math.round(gameBounds!.width)}x${Math.round(gameBounds!.height)} playerEnvelope=${Math.round(playerBounds!.width)}x${Math.round(playerBounds!.height)} x=${Math.round(gameBounds!.x)} scroll=${await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight].join("x"))}`);

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
