import { expect, test } from "@playwright/test";
import { HUMAN_REACTION_WINDOW_MS, MULTITAP_WINDOW_MS } from "@/game/actions/use-microgame";
import { openScenarioApp } from "../helpers";
test.beforeEach(async ({ page }) => {
  const frozenTime = new Date("2026-01-01T00:00:00Z");
  await page.clock.install({ time: frozenTime });
  await page.clock.pauseAt(new Date(frozenTime.getTime() + 1_000));
  await openScenarioApp(page, true);
});

test("Timed Attack reveals NOW! before the 250 ms human response and scores that response highly", async ({ page }) => {
  await startPractice(page, "testthief");
  const overlay = page.getByTestId("microgame-overlay");

  const instruction = overlay.getByText("Tap...", { exact: true });
  await expect(instruction).toBeVisible();
  await expect(overlay.getByText("Wait for NOW!", { exact: true })).toHaveCount(0);
  await expect(overlay.getByText("Tap in 250 ms", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("timed-attack-now")).toHaveCount(0);
  await page.clock.runFor(999);
  await expect(instruction).toBeVisible();
  await expect(page.getByTestId("timed-attack-now")).toHaveCount(0);
  await page.clock.runFor(16);
  const cue = page.getByTestId("timed-attack-now");
  await expect(cue).toBeVisible();
  await expect(instruction).toBeVisible();

  await page.clock.runFor(HUMAN_REACTION_WINDOW_MS);
  await page.getByRole("button", { name: "Tap the game screen" }).click();
  await expect(overlay).toHaveCount(0);
  await expect(page.getByText("Level 1 Map", { exact: true })).toBeVisible();
});

test("Concentration scores the press at the moment the moving circle reaches the target", async ({ page }) => {
  test.setTimeout(60_000);
  await startPractice(page, "testcleric");
  const overlay = page.getByTestId("microgame-overlay");
  const movingCircle = page.getByTestId("concentration-mover");
  const outline = page.getByTestId("concentration-target");
  const track = page.getByTestId("concentration-track");
  await expect(overlay.getByTestId("concentration-instruction")).toHaveAttribute("aria-label", "Tap when the filled circle fills the target circle");
  await expect(outline).toBeVisible();

  const trackBox = await track.boundingBox();
  expect(trackBox?.width ?? 0).toBeGreaterThan(100);
  const targetBox = await outline.boundingBox();
  expect(targetBox).not.toBeNull();
  const targetCenter = targetBox!.x + targetBox!.width / 2;
  const initialMoverBox = await movingCircle.boundingBox();
  expect(initialMoverBox).not.toBeNull();
  const initialMoverCenter = initialMoverBox!.x + initialMoverBox!.width / 2;
  expect(Math.abs(initialMoverCenter - targetCenter)).toBeGreaterThanOrEqual((initialMoverBox!.width + targetBox!.width) / 2);
  const initialDistance = Math.abs(initialMoverCenter - targetCenter);
  const expectedTargetMs = ((0.9 - (targetCenter - trackBox!.x) / trackBox!.width) / 0.8) * 1500;
  await page.clock.runFor(32);
  let alignedAt: number | null = null;
  for (let elapsed = 0; elapsed < 1250; elapsed += 16) {
    const moverBox = await movingCircle.boundingBox();
    expect(moverBox).not.toBeNull();
    const moverCenter = moverBox!.x + moverBox!.width / 2;
    if (Math.abs(moverCenter - targetCenter) <= 12) {
      alignedAt = elapsed;
      break;
    }
    if (elapsed === 0) expect(Math.abs(moverCenter - targetCenter)).toBeLessThan(initialDistance);
    await page.clock.runFor(16);
  }
  expect(alignedAt, "the moving circle must reach the visible target").not.toBeNull();
  expect(Math.abs(alignedAt! - expectedTargetMs)).toBeLessThanOrEqual(160);
  await page.getByRole("button", { name: "Tap the game screen" }).click();
  await expect(overlay).toHaveCount(0);
  await expect(page.getByText("Level 1 Map", { exact: true })).toBeVisible();
});

test("Multitap target stays on the right hand side for right-handed controls", async ({ page }) => verifyMultitapHandedness(page, "right"));
test("Multitap target stays on the left hand side for left-handed controls", async ({ page }) => verifyMultitapHandedness(page, "left"));

async function verifyMultitapHandedness(page: import("@playwright/test").Page, handedness: "left" | "right") {
  await startPractice(page, "testwarrior", handedness);
  const overlay = page.getByTestId("microgame-overlay");
  const target = page.getByRole("button", { name: "Tap circle" });
  const track = page.getByTestId("multitap-track");
  await expect(overlay.getByTestId("multitap-instruction")).toHaveAttribute("aria-label", "Tap the filled circle as quickly as you can");
  const positions = new Set<string>();
  const firstTarget = await target.boundingBox();
  const trackBounds = await track.boundingBox();
  expect(firstTarget).not.toBeNull();
  expect(trackBounds).not.toBeNull();
  if (handedness === "right") {
    expect(firstTarget!.x + firstTarget!.width / 2).toBeGreaterThan(trackBounds!.x + trackBounds!.width / 2);
  } else {
    expect(firstTarget!.x + firstTarget!.width / 2).toBeLessThan(trackBounds!.x + trackBounds!.width / 2);
  }

  positions.add(`${Math.round(firstTarget!.x)},${Math.round(firstTarget!.y)}`);
  await page.clock.runFor(HUMAN_REACTION_WINDOW_MS);
  await target.click();
  const nextTarget = await target.boundingBox();
  expect(nextTarget).not.toBeNull();
  positions.add(`${Math.round(nextTarget!.x)},${Math.round(nextTarget!.y)}`);
  await expect(overlay).toBeVisible();
  await page.clock.runFor(MULTITAP_WINDOW_MS);
  await expect(overlay).toHaveCount(0);
  await expect(page.getByText("Level 1 Map", { exact: true })).toBeVisible();
  expect(positions.size).toBeGreaterThan(1);
}

async function startPractice(page: import("@playwright/test").Page, seed: string, handedness: "left" | "right" = "right") {
  await page.getByRole("button", { name: "Singleplayer" }).click();
  const leftHandedToggle = page.getByLabel("Left-handed controls");
  if (await leftHandedToggle.isChecked() !== (handedness === "left")) await leftHandedToggle.click();
  await page.getByRole("button", { name: "hard", exact: true }).click();
  await page.getByRole("textbox", { name: "Seed" }).fill(seed);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  const nextClassInstructions = page.getByRole("button", { name: "Next class instructions", exact: true });
  if (await nextClassInstructions.isVisible().catch(() => false)) {
    await nextClassInstructions.click();
    await page.getByRole("button", { name: "Start playing", exact: true }).click();
  }
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("dialog", { name: "Game menu" }).getByRole("button", { name: "Practice attack microgame" }).click();
  await expect(page.getByTestId("microgame-overlay")).toBeVisible();
  await expect(page.getByTestId("microgame-overlay").getByText("TEST", { exact: true })).toHaveCount(0);
}
