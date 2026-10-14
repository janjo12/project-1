import { expect, test } from "@playwright/test";
import { MULTITAP_WINDOW_MS } from "@/game/actions/use-microgame";

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
  await page.getByRole("button", { name: "Next", exact: true }).click();

  await expect(page.getByText("Damage: 10", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await expect(page.getByTestId("microgame-overlay")).toBeVisible();
  await page.clock.runFor(MULTITAP_WINDOW_MS + 100);
  await expect(page.getByTestId("microgame-overlay")).toBeHidden();
  await expect(page.getByText("Damage: 1", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Start", exact: true }).click();

  const sprites = page.getByTestId("pixel-sprite-image");
  await expect(sprites.first()).toBeVisible();
  const spriteData = await sprites.evaluateAll(elements => elements.map(element => {
    const nodes = [element, ...Array.from(element.querySelectorAll("*"))];
    const imageNode = nodes.find(node => getComputedStyle(node).backgroundImage !== "none");
    const style = imageNode ? getComputedStyle(imageNode) : null;
    return {
      sprite: element.getAttribute("aria-label") ?? element.parentElement?.getAttribute("aria-label") ?? "atlas sprite",
      background: style?.backgroundImage ?? "none",
      size: style?.backgroundSize ?? "auto",
      position: style?.backgroundPosition ?? "unset",
    };
  }));
  expect(spriteData.length).toBeGreaterThan(0);
  for (const sprite of spriteData) {
    expect(sprite.background, `${sprite.sprite} should load an atlas image`).toMatch(/^url\(/);
    expect(sprite.size).not.toBe("auto");
  }
  const atlasLoaded = await sprites.first().evaluate(element => {
    const nodes = [element, ...Array.from(element.querySelectorAll("*"))];
    const background = nodes.map(node => getComputedStyle(node).backgroundImage).find(value => value !== "none");
    const url = background?.match(/^url\(["']?(.*?)["']?\)$/)?.[1];
    if (!url) return Promise.resolve(false);
    return new Promise<boolean>(resolve => {
      const image = new Image();
      image.onload = () => resolve(image.naturalWidth > 0);
      image.onerror = () => resolve(false);
      image.src = url;
    });
  });
  expect(atlasLoaded).toBe(true);
  await expect(page.getByText(/\[(?:warrior_graphic|pixel_golem_graphic)\]/)).toHaveCount(0);
});
