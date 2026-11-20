import { expect, test } from "@playwright/test";
import { openScenarioApp } from "../helpers";

test("a hard-mode host sees the multiplayer turn timer and the stairs counter fits", async ({ browser, page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await openScenarioApp(page, true);
  const guestContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const guestPage = await guestContext.newPage();
  let roomCode = "";

  try {
    await page.getByRole("button", { name: "Multiplayer" }).click();
    await page.getByRole("button", { name: "Host game", exact: true }).click();
    await expect(page.getByText("Room code", { exact: true })).toBeVisible();
    roomCode = (await page.locator('[aria-label="Room code"]').textContent())?.trim() ?? "";
    expect(roomCode).toBeTruthy();

    await guestPage.goto(new URL("/", page.url()).toString(), { waitUntil: "domcontentloaded" });
    await guestPage.getByRole("button", { name: "Multiplayer" }).click();
    await guestPage.getByRole("button", { name: "Join game", exact: true }).click();
    await guestPage.getByRole("textbox", { name: "Room code" }).fill(roomCode);
    await guestPage.getByRole("button", { name: "Join room", exact: true }).click();
    await guestPage.getByRole("button", { name: "easy", exact: true }).click();
    await guestPage.getByRole("button", { name: "Start", exact: true }).click();

    await page.getByRole("button", { name: "Game options", exact: true }).click();
    await page.getByRole("button", { name: "hard", exact: true }).click();
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(page.getByTestId("class-briefing")).toBeVisible();
    await expect(guestPage.getByTestId("class-briefing")).toBeVisible();
    for (const playerPage of [page, guestPage]) {
      const continueButton = playerPage.getByRole("button", { name: "Continue to practice", exact: true });
      if (await continueButton.isVisible().catch(() => false)) await continueButton.click();
      await playerPage.getByRole("button", { name: "Start playing", exact: true }).click();
    }

    const timer = page.getByTestId("multiplayer-turn-timer");
    await expect(timer).toBeVisible();
    await expect(page.getByTestId("hard-turn-counter")).toBeVisible();
    await expect(guestPage.getByTestId("multiplayer-turn-timer")).toHaveCount(0);
    await expect(guestPage.getByTestId("hard-turn-counter")).toHaveCount(0);
    const objectiveFits = await page.getByTestId("hard-turn-counter").evaluate(element =>
      element.scrollWidth <= element.clientWidth + 1 && element.scrollHeight <= element.clientHeight + 1,
    );
    expect(objectiveFits).toBe(true);

    await page.getByRole("button", { name: /host · Support/ }).click();
    await expect(timer).toBeVisible();
    const timerValue = page.getByRole("progressbar", { name: "Turn timer" });
    const valueWhileWaiting = await timerValue.getAttribute("aria-valuenow");
    await page.waitForTimeout(300);
    expect(await timerValue.getAttribute("aria-valuenow")).toBe(valueWhileWaiting);
  } finally {
    await guestContext.close();
    await page.request.post("/api/multiplayer", { data: { type: "leave", code: roomCode, playerId: "host" } }).catch(() => undefined);
  }
});
