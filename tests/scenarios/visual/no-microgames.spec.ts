import { expect, test } from "@playwright/test";
import { GAME_PARAMETERS } from "@/game/config/gameparameters";
import { openScenarioApp } from "../helpers";

test("attacks resolve directly and enemies still respond when attack microgames are off", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openScenarioApp(page, true);

  await page.getByRole("button", { name: "Singleplayer", exact: true }).click();
  await page.getByRole("switch", { name: "Attack microgames", exact: true }).uncheck();
  await page.getByRole("textbox", { name: "Seed" }).fill("testwarrior");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByRole("button", { name: "Menu" })).toBeVisible();
  await expect(page.getByText("Level 1 Map", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start playing", exact: true }).click();

  // The reserved seed puts the key one room ahead and the first lock on the route.
  await page.getByRole("button", { name: /Tap right doorway to move/ }).last().click();
  await page.getByRole("button", { name: "Key", exact: true }).click();
  await page.getByRole("button", { name: /Tap left doorway to move/ }).last().click();
  await page.getByRole("button", { name: /Tap right doorway to move/ }).last().click();
  const roomBeforeLock = await readRoomId(page);
  const lockedDoorway = page.getByRole("button", { name: /locked doorway/ }).last();
  await expect(lockedDoorway).toBeEnabled();
  await expect(lockedDoorway.getByText("🔒", { exact: true })).toHaveCount(1);
  await lockedDoorway.click();
  await expect.poll(() => readRoomId(page)).not.toBe(roomBeforeLock);
  await page.getByRole("button", { name: /Tap left doorway to move/ }).last().click();
  await page.getByRole("button", { name: /Tap left doorway to move/ }).last().click();
  await page.getByRole("button", { name: /Tap bottom doorway to move/ }).last().click();

  const enemyHealth = page.getByRole("progressbar", { name: "Enemy health" });
  const playerHealth = page.getByRole("progressbar", { name: "Player health" });
  await expect(page.getByTestId("current-dungeon-room")).toHaveAttribute("aria-label", /Room B4/);
  await expect(page.getByTestId("map-guarded-doorway-B4-bottom")).toHaveText("×");
  await expect(page.getByTestId("map-guarded-doorway-B4-bottom")).toHaveCSS("color", "rgb(220, 38, 38)");
  const guardedDoorway = page.getByRole("button", { name: /guarded doorway/ }).first();
  await expect(guardedDoorway).toBeDisabled();
  await expect(guardedDoorway.getByText("🛡️", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Pixel Golem", exact: true })).toBeVisible();
  // Let the enemy finish its entrance/attack motion so this checks its idle alignment.
  await page.waitForTimeout(700);
  const healthBarCenters = await page.getByTestId("enemy-health-bar").evaluateAll(bars => bars.map(bar => {
    const actor = bar.closest('[data-testid^="room-actor-enemy-"]');
    const sprite = actor?.querySelector('[role="img"]');
    if (!actor || !sprite) return null;
    const barBox = bar.getBoundingClientRect();
    const spriteBox = sprite.getBoundingClientRect();
    return { offset: Math.abs((barBox.left + barBox.width / 2) - (spriteBox.left + spriteBox.width / 2)), bar: { left: barBox.left, width: barBox.width }, sprite: { left: spriteBox.left, width: spriteBox.width }, actor: actor.getBoundingClientRect().toJSON() };
  }));
  expect(healthBarCenters.length).toBeGreaterThan(0);
  for (const measurement of healthBarCenters) {
    expect(measurement).not.toBeNull();
    expect(measurement!.offset, JSON.stringify(measurement)).toBeLessThanOrEqual(1);
  }
  const initialEnemyHealth = Number(await enemyHealth.getAttribute("aria-valuenow"));
  const initialPlayerHealth = Number(await playerHealth.getAttribute("aria-valuenow"));
  expect(initialEnemyHealth).toBe(Number(await enemyHealth.getAttribute("aria-valuemax")));
  expect(initialPlayerHealth).toBe(Number(await playerHealth.getAttribute("aria-valuemax")));

  await page.getByRole("button", { name: "Pixel Golem", exact: true }).click();
  await expect(page.getByTestId("microgame-overlay")).toHaveCount(0);
  const expectedDirectAttackDamage = Math.floor(GAME_PARAMETERS.combat.normalAttackDamage * 1.1);
  await expect(enemyHealth).toHaveAttribute("aria-valuenow", String(initialEnemyHealth - expectedDirectAttackDamage), { timeout: 5000 });
  await expect.poll(async () => Number(await playerHealth.getAttribute("aria-valuenow"))).toBeLessThan(initialPlayerHealth);
});

async function readRoomId(page: import("@playwright/test").Page) {
  const label = await page.getByTestId("current-dungeon-room").getAttribute("aria-label");
  const room = label?.match(/Room ([A-F](?:1[0-2]|[1-9]))/)?.[1];
  if (!room) throw new Error(`Could not read current room: ${label}`);
  return room;
}

