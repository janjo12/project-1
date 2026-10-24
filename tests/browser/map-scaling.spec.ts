import { expect, test } from "@playwright/test";
import { createSeededDungeonMap } from "@/game/dungeon/generateDungeon";
import { openFreshApp, startTestGame } from "./helpers";

test("the rendered floor map uses the generated grid bounds and scales its cells to fit", async ({ page }) => {
  const generatedMap = createSeededDungeonMap("testwarrior", 1);
  await page.setViewportSize({ width: 430, height: 900 });
  await openFreshApp(page);
  await startTestGame(page);

  const map = page.getByTestId("dungeon-map");
  await expect(map).toBeVisible();
  await expect(map.getByText("Level 1 Map", { exact: true })).toBeVisible();
  await expect(page.locator("[data-testid^='map-row-label-']")).toHaveCount(generatedMap.columns.length);
  await expect(page.locator("[data-testid^='map-column-label-']")).toHaveCount(generatedMap.rows.length);
  await expect(page.locator("[data-testid^='map-cell-']")).toHaveCount(generatedMap.columns.length * generatedMap.rows.length);
  const mapBounds = await map.boundingBox();
  const currentCell = await page.getByTestId(`map-cell-${generatedMap.startingRoomId}`).boundingBox();
  expect(mapBounds).not.toBeNull();
  expect(currentCell).not.toBeNull();
  expect(currentCell!.width).toBeGreaterThan(0);
  expect(currentCell!.height).toBeGreaterThan(0);
  expect(currentCell!.x).toBeGreaterThanOrEqual(mapBounds!.x);
  expect(currentCell!.y).toBeGreaterThanOrEqual(mapBounds!.y);
});
