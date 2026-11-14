import { expect, test } from "@playwright/test";
import { openScenarioApp } from "../helpers";

const dedicatedClassSeeds = [
  { seed: "testwarrior", className: "Warrior" },
  { seed: "testcleric", className: "Cleric" },
  { seed: "testthief", className: "Thief" },
  { seed: "testwizard", className: "Wizard" },
  { seed: "testranger", className: "Ranger" },
];

for (const { seed, className } of dedicatedClassSeeds) {
  test(`${seed} starts the shared ${className} gameplay`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openScenarioApp(page, true);

    await page.getByRole("button", { name: "Singleplayer", exact: true }).click();
    await page.getByRole("textbox", { name: "Seed" }).fill(seed);
    await page.getByRole("button", { name: "Start", exact: true }).click();

    await expect(page.getByTestId("class-briefing")).toBeVisible();
    await expect(page.getByRole("img", { name: `${className} class sprite` })).toBeVisible();
    const nextClassInstructions = page.getByRole("button", { name: "Continue to practice", exact: true });
    if (await nextClassInstructions.isVisible().catch(() => false)) {
      await nextClassInstructions.click();
      await page.getByRole("button", { name: "Start playing", exact: true }).click();
    } else {
      await page.getByRole("button", { name: "Start playing", exact: true }).click();
    }

    await expect(page.getByRole("button", { name: "Menu", exact: true })).toBeVisible();
    await expect(page.getByText("Level 1 Map", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(`${className}.*Support`) })).toBeVisible();
  });
}
