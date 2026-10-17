import { expect, test } from "@playwright/test";

/**
 * Runs on the connected Android emulator through Android's UI test driver.
 * Start the app with the emulator and expose its Metro/Expo dev server first.
 * The same semantic flow is used by tests/visual/layout.spec.ts on web.
 */
test("phone: setup, settings, game menu, and seeded run reach level 2 without render errors", async ({ page }) => {
  test.setTimeout(180_000);
  const runtimeErrors: string[] = [];
  page.on("pageerror", error => runtimeErrors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Singleplayer" })).toBeVisible();
  await page.getByRole("button", { name: "Singleplayer" }).click();
  await expect(page.getByText("Difficulty", { exact: true })).toBeVisible();
  await expect(page.getByText("Attack microgames", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByText("Settings", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();

  // Reserved deterministic layout makes the level-two route reproducible on device.
  await page.getByRole("textbox", { name: "Seed" }).fill("testwarrior");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByTestId("class-briefing")).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByRole("button", { name: "Menu" })).toBeVisible();
  await expect(page.getByTestId("room-incoming-snapshot")).toBeVisible();
  await page.getByRole("button", { name: "Menu" }).click();
  const gameMenu = page.getByRole("dialog", { name: "Game menu" });
  await expect(gameMenu).toBeVisible();
  await expect(gameMenu.getByText("Reduce motion", { exact: true })).toHaveCount(1);
  await gameMenu.getByRole("button", { name: "Back to Game" }).click();

  // The deterministic warrior test dungeon is laid out so the stairs are reachable in a few taps.
  // Follow visible doorways and clear only enemies blocking the route.
  let reachedLevelTwo = false;
  for (let step = 0; step < 80; step += 1) {
    if (await page.getByText(/TEST · .*Level 2/).isVisible().catch(() => false)) {
      reachedLevelTwo = true;
      break;
    }
    const stairs = page.getByRole("button", { name: "Stairs", exact: true });
    if (await stairs.isVisible().catch(() => false)) {
      await stairs.click();
      await expect(page.getByText(/TEST · .*Level 2/)).toBeVisible({ timeout: 10_000 });
      reachedLevelTwo = true;
      break;
    }
    const enemy = page.getByRole("button", { name: /^(Pixel Golem|Zombie|Dragon|Vampire|Werewolf)$/ }).first();
    if (await enemy.isVisible().catch(() => false)) {
      await enemy.click();
      const circle = page.getByRole("button", { name: "Tap circle" });
      for (let tap = 0; tap < 8; tap += 1) {
        if (await circle.isVisible().catch(() => false)) await circle.click();
      }
      continue;
    }
    const doorway = page.getByRole("button", { name: /Tap .* doorway to move/ }).first();
    if (await doorway.isVisible().catch(() => false)) {
      await doorway.click();
      continue;
    }
    await page.waitForTimeout(100);
  }

  expect(reachedLevelTwo, "the phone run should reach Level 2").toBe(true);
  expect(runtimeErrors, "phone runtime/rendering errors").toEqual([]);
});
