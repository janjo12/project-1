import { expect, test } from "@playwright/test";
import { GAME_PARAMETERS } from "@/game/config/gameparameters";
import { MULTITAP_TARGET_TAPS } from "@/game/actions/use-microgame";

test("web renders atlas sprites and a completed attack reduces enemy health", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: "Singleplayer" }).click();
  await page.getByRole("textbox", { name: "Seed" }).fill("testwarrior");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Start", exact: true }).click();

  const sprites = page.getByTestId("pixel-sprite-image");
  await expect(sprites.first()).toBeVisible();
  const spriteData = await sprites.evaluateAll(elements => elements.map(element => {
    const style = getComputedStyle(element);
    return {
      sprite: element.getAttribute("data-sprite"),
      background: style.backgroundImage,
      size: style.backgroundSize,
      position: style.backgroundPosition,
    };
  }));
  expect(spriteData.length).toBeGreaterThan(0);
  for (const sprite of spriteData) {
    expect(sprite.sprite).toBeTruthy();
    expect(sprite.background, `${sprite.sprite} should load an atlas image`).toMatch(/^url\(/);
    expect(sprite.size).not.toBe("auto");
  }
  await expect(page.getByText(/\[(?:warrior_graphic|pixel_golem_graphic)\]/)).toHaveCount(0);

  const enemy = page.getByRole("button", { name: "Pixel Golem", exact: true }).first();
  const healthBar = enemy.getByTestId("enemy-health-bar");
  const healthBefore = Number(await healthBar.getAttribute("aria-valuenow"));
  await enemy.click();
  await expect(page.getByTestId("microgame-overlay")).toBeVisible();
  const tapTarget = page.getByRole("button", { name: "Tap circle" });
  for (let tap = 0; tap < MULTITAP_TARGET_TAPS; tap += 1) {
    await tapTarget.click();
  }
  await expect(page.getByTestId("microgame-overlay")).toBeHidden();
  await expect.poll(async () => Number(await healthBar.getAttribute("aria-valuenow")), {
    timeout: GAME_PARAMETERS.animation.attackDurationMs + 2_000,
  }).toBeLessThan(healthBefore);
});
