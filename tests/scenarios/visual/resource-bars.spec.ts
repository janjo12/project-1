import { expect, test } from "@playwright/test";
import { openScenarioApp } from "../helpers";

test("resource icons are solid and larger without changing bar size or spacing", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 900 });
  await openScenarioApp(page, true);
  await page.getByRole("button", { name: "Singleplayer" }).click();
  await page.getByRole("button", { name: "hard", exact: true }).click();
  await page.getByRole("textbox", { name: "Seed" }).fill("testwarrior");
  await page.getByRole("button", { name: "Start", exact: true }).click();

  const ids = ["player-health-bar", "player-energy-bar", "turn-timer"];
  const rowBounds = await Promise.all(ids.map(id => page.getByTestId(id).boundingBox()));
  const iconBounds = await Promise.all(ids.map(id => page.getByTestId(`${id}-glyph`).boundingBox()));
  const trackBounds = await Promise.all(ids.map(id => page.getByTestId(`${id}-track`).boundingBox()));
  expect(rowBounds.every(Boolean)).toBe(true);
  expect(iconBounds.every(Boolean)).toBe(true);
  expect(trackBounds.every(Boolean)).toBe(true);
  for (const bounds of iconBounds) {
    expect(bounds!.width).toBeGreaterThanOrEqual(16);
    expect(bounds!.height).toBeGreaterThanOrEqual(16);
  }
  for (let index = 1; index < ids.length; index++) {
    expectWithinOnePixel(rowBounds[index]!.width, rowBounds[0]!.width);
    expectWithinOnePixel(rowBounds[index]!.height, rowBounds[0]!.height);
    expectWithinOnePixel(trackBounds[index]!.width, trackBounds[0]!.width);
    expectWithinOnePixel(trackBounds[index]!.height, trackBounds[0]!.height);
  }
  await expect(page.getByTestId("turn-timer-glyph")).toHaveAttribute("data-icon", "hourglass");
  await expect(page.getByTestId("turn-timer-glyph")).toHaveCSS("color", "rgb(168, 85, 247)");
});

function expectWithinOnePixel(actual: number, expected: number) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1);
}
