import { expect, test } from "@playwright/test";
import { openScenarioApp } from "../helpers";

type RoomResponse = {
  code: string;
  playerId: string;
  deadlineAt: number | null;
  playerOptions: { difficulty: string };
  players: { id: string }[];
  state: { turnsLeft: number } | null;
};

test("Normal and Easy players share a budget, but only Normal sees its counter", async ({ browser, page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await openScenarioApp(page, true);
  const easyContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const easyPage = await easyContext.newPage();
  let roomCode = "";

  try {
    await page.getByRole("button", { name: "Multiplayer" }).click();
    await page.getByRole("button", { name: "Host game", exact: true }).click();
    roomCode = (await page.locator('[aria-label="Room code"]').textContent())?.trim() ?? "";
    expect(roomCode).toBeTruthy();

    await easyPage.goto(new URL("/", page.url()).toString(), { waitUntil: "domcontentloaded" });
    await easyPage.getByRole("button", { name: "Multiplayer" }).click();
    await easyPage.getByRole("button", { name: "Join game", exact: true }).click();
    await easyPage.getByRole("textbox", { name: "Room code" }).fill(roomCode);
    await easyPage.getByRole("button", { name: "Join room", exact: true }).click();
    await easyPage.getByRole("button", { name: "easy", exact: true }).click();
    await easyPage.getByRole("button", { name: "Start", exact: true }).click();

    await page.getByRole("button", { name: "Game options", exact: true }).click();
    await page.getByRole("button", { name: "normal", exact: true }).click();
    await page.getByRole("button", { name: "Start", exact: true }).click();
    for (const playerPage of [page, easyPage]) {
      const practice = playerPage.getByRole("button", { name: "Continue to practice", exact: true });
      if (await practice.isVisible().catch(() => false)) await practice.click();
      await playerPage.getByRole("button", { name: "Start playing", exact: true }).click();
    }

    const hostResponse = await page.request.get("/api/multiplayer", { params: { code: roomCode, playerId: "host" } });
    expect(hostResponse.ok()).toBe(true);
    const hostView = await hostResponse.json() as RoomResponse;
    const easyId = hostView.players.find(player => player.id !== "host")?.id;
    expect(easyId).toBeTruthy();
    const easyResponse = await page.request.get("/api/multiplayer", { params: { code: roomCode, playerId: easyId! } });
    expect(easyResponse.ok()).toBe(true);
    const easyView = await easyResponse.json() as RoomResponse;

    expect(hostView.playerOptions.difficulty).toBe("normal");
    expect(easyView.playerOptions.difficulty).toBe("easy");
    expect(hostView.deadlineAt).toBeNull();
    expect(easyView.deadlineAt).toBeNull();
    expect(hostView.state?.turnsLeft).toBeGreaterThan(0);
    expect(easyView.state?.turnsLeft).toBe(hostView.state?.turnsLeft);
    await expect(page.getByTestId("multiplayer-turn-timer")).toHaveCount(0);
    await expect(easyPage.getByTestId("multiplayer-turn-timer")).toHaveCount(0);
    await expect(page.getByTestId("hard-turn-counter")).toBeVisible();
    await expect(easyPage.getByTestId("hard-turn-counter")).toHaveCount(0);
  } finally {
    await easyContext.close();
    if (roomCode) {
      await page.request.post("/api/multiplayer", { data: { type: "leave", code: roomCode, playerId: "host" } }).catch(() => undefined);
    }
  }
});
