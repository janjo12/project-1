import { expect, test } from "@playwright/test";
import { MULTITAP_TARGET_TAPS, MULTITAP_WINDOW_MS } from "@/game/actions/use-microgame";

test("web renders atlas sprites and practice timeout updates the damage preview", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const fixedTime = new Date("2026-01-01T00:00:00Z");
  await page.clock.install({ time: fixedTime });
  await page.clock.pauseAt(fixedTime);
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: "Singleplayer" }).click();
  await page.getByRole("textbox", { name: "Seed" }).fill("testwarrior");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByRole("button", { name: "Next class instructions", exact: true }).click();

  await expect(page.getByText("Damage: 10", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Practice attack game", exact: true }).click();
  await expect(page.getByTestId("microgame-overlay")).toBeVisible();
  const practiceSprite = page.getByTestId("microgame-overlay").getByTestId("pixel-sprite-image").locator("img");
  await expect(practiceSprite).toBeVisible();
  await expect.poll(() => practiceSprite.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.clock.runFor(MULTITAP_WINDOW_MS + 100);
  await expect(page.getByTestId("microgame-overlay")).toBeHidden();
  await expect(page.getByText("Damage: 1", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Start playing", exact: true }).click();

  const sprites = page.getByTestId("pixel-sprite-image");
  await expect(sprites.first()).toBeVisible();
  const spriteData = await sprites.evaluateAll(elements => elements.map(element => {
    const image = element.querySelector("img") as HTMLImageElement | null;
    const style = image ? getComputedStyle(image) : null;
    return {
      sprite: element.getAttribute("aria-label") ?? "atlas sprite",
      source: image?.currentSrc ?? "",
      naturalWidth: image?.naturalWidth ?? 0,
      size: style?.width ?? "0px",
    };
  }));
  expect(spriteData.length).toBeGreaterThan(0);
  for (const sprite of spriteData) {
    expect(sprite.source, `${sprite.sprite} should have an atlas source`).toMatch(/\.(png|webp)/);
    expect(sprite.naturalWidth, `${sprite.sprite} atlas image should load`).toBeGreaterThan(0);
    expect(sprite.size).not.toBe("0px");
  }
  await expect(page.getByText(/\[(?:warrior_graphic|pixel_golem_graphic)\]/)).toHaveCount(0);
});
