import { expect, test } from "@playwright/test";
import { MULTITAP_WINDOW_MS } from "@/game/actions/use-microgame";
import { openScenarioApp } from "../helpers";

test("web renders atlas sprites and practice attack remains available from the pause menu", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const fixedTime = new Date("2026-01-01T00:00:00Z");
  await page.clock.install({ time: fixedTime });
  await page.clock.pauseAt(fixedTime);
  await openScenarioApp(page, true);

  await page.getByRole("button", { name: "Singleplayer" }).click();
  await page.getByRole("textbox", { name: "Seed" }).fill("testwarrior");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("dialog", { name: "Game menu" }).getByRole("button", { name: "Practice attack microgame" }).click();
  const microgame = page.getByTestId("microgame-overlay");
  await expect(microgame).toBeVisible();
  await expect(microgame.getByText("Tap the ●")).toHaveCount(0);
  await expect(microgame.getByTestId("pixel-sprite-image")).toHaveCount(0);
  await page.clock.runFor(MULTITAP_WINDOW_MS + 100);
  await expect(page.getByTestId("microgame-overlay")).toBeHidden();

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
