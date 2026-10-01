import { expect, test } from "@playwright/test";

const HARD_TURN_DURATION_MS = 5_000;
const TIMER_TICK_MS = 100;

test("opens the app, plays a complete seeded hard-mode run, and returns to the title menu", async ({ page }) => {
  await page.clock.install();

  // Start from a clean launch, just as a newly installed player would.
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole("button", { name: "Singleplayer" })).toBeVisible();

  // Select hard mode and the reserved deterministic test dungeon.
  await page.getByRole("button", { name: "Singleplayer" }).click();
  await expect(page.getByText("Difficulty", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "hard", exact: true }).click();
  await page.getByRole("textbox", { name: "Seed" }).fill("test");
  await expect(page.getByRole("button", { name: "Start", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Start", exact: true }).click();

  // Read both class briefing pages before starting the actual run.
  await expect(page.getByTestId("class-briefing")).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByTestId("class-briefing")).toBeVisible();
  await page.getByRole("button", { name: "Start", exact: true }).click();

  const turnCounter = page.getByTestId("hard-turn-counter");
  const turnTimer = page.getByTestId("turn-timer");
  await expect(page.getByRole("button", { name: "Menu" })).toBeVisible();
  await expect(page.getByText(/TEST ·/)).toBeVisible();
  await expect(turnCounter).toBeVisible();
  await expect(turnTimer).toBeVisible();

  // Let the player's hard-mode deadlines resolve into automatic defend actions.
  // The test dungeon has no regular enemies in its starting room, so the run ends
  // when its seeded hard-mode turn budget is exhausted.
  let turnsRemaining = Number((await turnCounter.innerText()).match(/(\d+) Turns?$/)?.[1]);
  expect(Number.isFinite(turnsRemaining)).toBe(true);
  expect(turnsRemaining).toBeGreaterThan(0);

  const maximumTurns = turnsRemaining + 2;
  for (let elapsedTurn = 0; elapsedTurn < maximumTurns; elapsedTurn += 1) {
    await page.clock.runFor(HARD_TURN_DURATION_MS + TIMER_TICK_MS);
    if (await page.getByText("Game Over", { exact: true }).isVisible().catch(() => false)) {
      break;
    }
    const currentCounter = await turnCounter.innerText();
    const nextTurnsRemaining = Number(currentCounter.match(/(\d+) Turns?$/)?.[1]);
    expect(Number.isFinite(nextTurnsRemaining), `could not read turn budget: ${currentCounter}`).toBe(true);
    expect(nextTurnsRemaining, "a hard-mode timer expiration should resolve a turn").toBeLessThan(turnsRemaining);
    turnsRemaining = nextTurnsRemaining;
  }

  await expect(page.getByText("Game Over", { exact: true })).toBeVisible();
  await expect(page.getByText("Score: 0", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Return to Title" })).toBeVisible();
  await page.getByRole("button", { name: "Return to Title" }).click();

  // Finish on the app's title menu, ready to begin another run.
  await expect(page.getByRole("button", { name: "Singleplayer" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Multiplayer · Same Wi-Fi" })).toBeVisible();
});
