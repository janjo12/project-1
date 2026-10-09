import { expect, test, type Page } from "@playwright/test";

const viewports = [
  { name: "small-phone-portrait", width: 320, height: 568 },
  { name: "phone-portrait", width: 360, height: 640 },
  { name: "large-phone-portrait", width: 430, height: 932 },
  { name: "phone-landscape", width: 844, height: 390 },
  { name: "tablet-portrait", width: 768, height: 1024 },
  { name: "tablet-landscape", width: 1024, height: 768 },
  { name: "desktop", width: 1366, height: 768 },
];

async function expectScreenFits(page: Page, screenName: string) {
  const measurements = await page.evaluate(() => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const clippingParents = [document.documentElement, document.body, ...Array.from(document.querySelectorAll("*"))]
      .filter(element => {
        const style = getComputedStyle(element);
        return /(hidden|clip|auto|scroll)/.test(`${style.overflow} ${style.overflowX} ${style.overflowY}`);
      });
    const candidates = Array.from(document.querySelectorAll("[role='dialog'], [data-testid='class-briefing'], [data-testid='microgame-overlay']"))
      .filter(element => {
        const style = getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
      });
    const visualSurface = candidates[candidates.length - 1];
    const elementsToCheck = visualSurface
      ? [visualSurface, ...Array.from(visualSurface.querySelectorAll("button, input, textarea, h1, h2, p, label"))]
      : Array.from(document.querySelectorAll("button, input, textarea, h1, h2, p, label"));
    const visibleElements = elementsToCheck
      .filter(element => {
        const style = getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
      });
    const clipped: string[] = [];

    for (const element of visibleElements) {
      const bounds = element.getBoundingClientRect();
      if (bounds.width === 0 || bounds.height === 0) continue;
      const hitTarget = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
      if (hitTarget && hitTarget !== element && !element.contains(hitTarget) && !hitTarget.contains(element)) continue;
      let visible = {
        left: Math.max(0, bounds.left),
        top: Math.max(0, bounds.top),
        right: Math.min(viewport.width, bounds.right),
        bottom: Math.min(viewport.height, bounds.bottom),
      };

      for (const parent of clippingParents) {
        if (parent === element || !parent.contains(element)) continue;
        const style = getComputedStyle(parent);
        const parentBounds = parent.getBoundingClientRect();
        if (/(hidden|clip|auto|scroll)/.test(style.overflowX)) {
          visible.left = Math.max(visible.left, parentBounds.left);
          visible.right = Math.min(visible.right, parentBounds.right);
        }
        if (/(hidden|clip|auto|scroll)/.test(style.overflowY)) {
          visible.top = Math.max(visible.top, parentBounds.top);
          visible.bottom = Math.min(visible.bottom, parentBounds.bottom);
        }
      }

      const visibleWidth = Math.max(0, visible.right - visible.left);
      const visibleHeight = Math.max(0, visible.bottom - visible.top);
      if (visibleWidth + 1 < bounds.width || visibleHeight + 1 < bounds.height) {
        const label = element.textContent?.trim() || element.getAttribute("aria-label") || element.tagName;
        clipped.push(`${element.tagName.toLowerCase()} “${label.slice(0, 60)}” (${Math.round(visibleWidth)}×${Math.round(visibleHeight)} visible of ${Math.round(bounds.width)}×${Math.round(bounds.height)})`);
      }
    }

    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: viewport.width,
      clipped,
      preview: (() => {
        const frame = document.querySelector(".phone-preview");
        return frame ? {
          bounds: frame.getBoundingClientRect().toJSON(),
          css: {
            height: getComputedStyle(frame).height,
            maxHeight: getComputedStyle(frame).maxHeight,
            minHeight: getComputedStyle(frame).minHeight,
            width: getComputedStyle(frame).width,
            maxWidth: getComputedStyle(frame).maxWidth,
          },
          viewportHeight: window.innerHeight,
        } : null;
      })(),
    };
  });

  expect(measurements.documentWidth, `${screenName}: horizontal page overflow`).toBeLessThanOrEqual(measurements.viewportWidth);
  expect(measurements.clipped, `${screenName}: content clipped by viewport or an overflow container; preview ${JSON.stringify(measurements.preview)}`).toEqual([]);
}

for (const viewport of viewports) {
  test(`${viewport.name}: key screens and overlays fit without clipping`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await expect(page.getByRole("button", { name: "Singleplayer" })).toBeVisible();
    await expectScreenFits(page, "title");

    await page.getByRole("button", { name: "Singleplayer" }).click();
    await expect(page.getByText("Difficulty", { exact: true })).toBeVisible();
    await expectScreenFits(page, "setup");

    await page.getByRole("button", { name: "Difficulty help" }).click();
    await expect(page.getByRole("dialog", { name: "Difficulty help" })).toBeVisible();
    await expectScreenFits(page, "setup help dialog");
    await page.getByRole("button", { name: "Got it" }).click();

    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByText("Settings", { exact: true })).toBeVisible();
    await expectScreenFits(page, "settings");
    await page.getByRole("button", { name: "Back" }).click();

    await page.getByRole("textbox", { name: "Seed" }).fill("testwarrior");
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.getByRole("button", { name: "Next", exact: true })).toBeVisible();
    await expectScreenFits(page, "class briefing");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expectScreenFits(page, "class instructions");
    await page.getByRole("button", { name: "Start", exact: true }).click();

    await expect(page.getByRole("button", { name: "Menu" })).toBeVisible();
    await expectScreenFits(page, "gameplay");
    if (viewport.height < 500) {
      await page.getByRole("button", { name: "Menu" }).click();
      const landscapeMenu = page.getByRole("dialog", { name: "Game menu" });
      await expect(landscapeMenu).toBeVisible();
      await expectScreenFits(page, "landscape game menu");
      await landscapeMenu.getByRole("button", { name: "Open dungeon map" }).click();
      await expect(page.getByRole("dialog", { name: "Dungeon map" })).toBeVisible();
      await expectScreenFits(page, "dungeon map dialog");
      await page.getByRole("button", { name: "Close map" }).click();
    }
    await page.getByRole("button", { name: "Menu" }).click();
    await expect(page.getByRole("dialog", { name: "Game menu" })).toBeVisible();
    await expectScreenFits(page, "game menu");
    await page.getByRole("dialog", { name: "Game menu" }).getByRole("button", { name: "Practice attack microgame" }).click();
    await expect(page.getByTestId("microgame-overlay")).toBeVisible();
    await expectScreenFits(page, "microgame overlay");

    await page.reload();
    await page.getByRole("button", { name: "Multiplayer · Same Wi-Fi" }).click();
    await page.getByRole("textbox", { name: "Seed" }).fill("testwarrior");
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.getByText("Same Wi-Fi multiplayer", { exact: true })).toBeVisible();
    await expectScreenFits(page, "multiplayer lobby");
  });
}
