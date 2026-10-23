import { expect, test } from "@playwright/test";
import { HUMAN_REACTION_WINDOW_MS } from "@/game/actions/use-microgame";
const MICROGAME_START_URL = "/";

test.beforeEach(async ({ page }) => {
  const frozenTime = new Date("2026-01-01T00:00:00Z");
  await page.clock.install({ time: frozenTime });
  await page.clock.pauseAt(new Date(frozenTime.getTime() + 1_000));
  await page.goto(MICROGAME_START_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("Timed Attack reveals NOW! before the 250 ms human response and scores that response highly", async ({ page }) => {
  await startPractice(page, "testthief");
  const overlay = page.getByTestId("microgame-overlay");

  await expect(overlay.getByText("Wait for NOW!", { exact: true })).toBeVisible();
  await expect(page.getByTestId("timed-attack-now")).toHaveCount(0);
  await page.clock.runFor(999);
  await expect(page.getByTestId("timed-attack-now")).toHaveCount(0);
  await page.clock.runFor(16);
  const cue = page.getByTestId("timed-attack-now");
  await expect(cue).toBeVisible();
  await expect(overlay.getByText("Tap in 250 ms", { exact: true })).toBeVisible();

  await page.clock.runFor(HUMAN_REACTION_WINDOW_MS);
  await page.getByRole("button", { name: "Tap the game screen" }).click();
  await expect(overlay).toHaveCount(0);
  await expect(page.getByText(/Last microgame (9\d|100)\/100/)).toBeVisible();
});

test("Concentration places the target in the moving circle's path and awards a realistic reaction", async ({ page }) => {
  await startPractice(page, "testcleric");
  const overlay = page.getByTestId("microgame-overlay");
  const movingCircle = page.getByTestId("concentration-mover");
  const outline = page.getByTestId("concentration-target");
  const track = page.getByTestId("concentration-track");
  await expect(overlay.getByText("Tap when ● fills ○", { exact: true })).toBeVisible();
  await expect(outline).toBeVisible();

  await page.clock.runFor(32);
  const trackBox = await track.boundingBox();
  expect(trackBox?.width ?? 0).toBeGreaterThan(100);
  const targetBox = await outline.boundingBox();
  expect(targetBox).not.toBeNull();
  const targetCenter = targetBox!.x + targetBox!.width / 2;
  let alignedAt: number | null = null;
  for (let elapsed = 0; elapsed < 1250; elapsed += 16) {
    const moverBox = await movingCircle.boundingBox();
    expect(moverBox).not.toBeNull();
    const moverCenter = moverBox!.x + moverBox!.width / 2;
    if (Math.abs(moverCenter - targetCenter) <= 12) {
      alignedAt = elapsed;
      break;
    }
    await page.clock.runFor(16);
  }
  expect(alignedAt, "the moving circle must reach the visible target before the response window").not.toBeNull();
  expect(alignedAt).toBeGreaterThanOrEqual(800);
  expect(alignedAt).toBeLessThanOrEqual(1000);
  await page.clock.runFor(HUMAN_REACTION_WINDOW_MS);
  await page.getByRole("button", { name: "Tap the game screen" }).click();
  await expect(overlay).toHaveCount(0);
  await expect(page.getByText(/Last microgame (9\d|100)\/100/)).toBeVisible();
});

test("Multitap moves its visible target and counts six human-paced taps", async ({ page }) => {
  await startPractice(page, "testwarrior");
  const overlay = page.getByTestId("microgame-overlay");
  const target = page.getByRole("button", { name: "Tap circle" });
  await expect(overlay.getByText("Tap the ●", { exact: true })).toBeVisible();
  const positions = new Set<string>();

  for (let tap = 0; tap < 6; tap += 1) {
    const box = await target.boundingBox();
    expect(box).not.toBeNull();
    positions.add(`${Math.round(box!.x)},${Math.round(box!.y)}`);
    await page.clock.runFor(HUMAN_REACTION_WINDOW_MS);
    await target.click();
    if (tap < 5) await expect(page.getByTestId("multitap-progress")).toHaveText(`${tap + 1}/6 hits`);
    if (tap === 3) await expect(overlay).toBeVisible();
  }

  await expect(overlay).toHaveCount(0);
  await expect(page.getByText(/Last microgame 100\/100/)).toBeVisible();
  expect(positions.size).toBeGreaterThan(1);
});

async function startPractice(page: import("@playwright/test").Page, seed: string) {
  await page.getByRole("button", { name: "Singleplayer" }).click();
  await page.getByRole("button", { name: "hard", exact: true }).click();
  await page.getByRole("textbox", { name: "Seed" }).fill(seed);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByRole("button", { name: "Next class instructions", exact: true }).click();
  await page.getByRole("button", { name: "Start playing", exact: true }).click();
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("dialog", { name: "Game menu" }).getByRole("button", { name: "Practice attack microgame" }).click();
  await expect(page.getByTestId("microgame-overlay")).toBeVisible();
}
