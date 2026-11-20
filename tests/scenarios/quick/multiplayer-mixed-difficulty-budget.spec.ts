import { expect, test } from "@playwright/test";
import { openScenarioApp } from "../helpers";

type MultiplayerState = {
  turn: number;
  turnsLeft: number;
  ended: boolean;
  phase: string;
  map: { rooms: { id: string; north: string; east: string; south: string; west: string }[][] };
  players: Record<string, { health: number; roomId: string; gameplayOptions?: { difficulty: string } }>;
};

type RoomResponse = {
  code: string;
  playerId: string;
  deadlineAt: number | null;
  turnSubmitted: boolean;
  playerOptions: { difficulty: string };
  players: { id: string }[];
  state: MultiplayerState | null;
};

test("mixed difficulty gives only Hard players timed turns and turn-budget ghosting", async ({ browser, page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await openScenarioApp(page, true);
  const easyContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const easyPage = await easyContext.newPage();
  let roomCode = "";

  const poll = async (playerId: string) => {
    const response = await page.request.get("/api/multiplayer", { params: { code: roomCode, playerId } });
    expect(response.ok()).toBe(true);
    return response.json() as Promise<RoomResponse>;
  };
  const act = async (playerId: string, turn: number, action: Record<string, string>) =>
    page.request.post("/api/multiplayer", { data: { type: "action", code: roomCode, playerId, turn, action } });

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
    await easyPage.route("**/api/multiplayer", async route => {
      const request = route.request();
      if (request.method() === "POST" && (request.postDataJSON() as { type?: string } | null)?.type === "options") {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      await route.continue();
    });
    await easyPage.getByRole("button", { name: "hard", exact: true }).click();
    await easyPage.getByRole("button", { name: "easy", exact: true }).click();
    await easyPage.getByRole("button", { name: "Start", exact: true }).click();

    await page.getByRole("button", { name: "Game options", exact: true }).click();
    await page.getByRole("button", { name: "hard", exact: true }).click();
    await page.getByRole("button", { name: "Start", exact: true }).click();
    for (const playerPage of [page, easyPage]) {
      const practice = playerPage.getByRole("button", { name: "Continue to practice", exact: true });
      if (await practice.isVisible().catch(() => false)) await practice.click();
      await playerPage.getByRole("button", { name: "Start playing", exact: true }).click();
    }

    const hostView = await poll("host");
    const easyId = hostView.players.find(player => player.id !== "host")?.id;
    expect(easyId).toBeTruthy();
    const easyView = await poll(easyId!);
    expect(hostView.playerOptions.difficulty).toBe("hard");
    expect(easyView.playerOptions.difficulty).toBe("easy");
    expect(hostView.deadlineAt).not.toBeNull();
    expect(easyView.deadlineAt).toBeNull();
    await expect(page.getByTestId("multiplayer-turn-timer")).toBeVisible();
    await expect(easyPage.getByTestId("multiplayer-turn-timer")).toHaveCount(0);
    await expect(page.getByTestId("hard-turn-counter")).toBeVisible();
    await expect(easyPage.getByTestId("hard-turn-counter")).toHaveCount(0);

    let state = hostView.state!;
    expect(state.phase).toBe("playing");
    expect(state.turnsLeft).toBeGreaterThan(0);
    let resolvedRounds = 0;
    while (state.turnsLeft > 0 && resolvedRounds < 200) {
      const turn = state.turn;
      const [hardTurn, easyTurn] = await Promise.all([poll("host"), poll(easyId!)]);
      if (!hardTurn.turnSubmitted) {
        const response = await act("host", turn, { type: "DROP_EQUIPMENT" });
        expect([200, 409]).toContain(response.status());
      }
      if (!easyTurn.turnSubmitted) {
        const response = await act(easyId!, turn, { type: "DROP_EQUIPMENT" });
        expect(response.ok()).toBe(true);
      }
      const next = await poll("host");
      state = next.state!;
      if (state.turn > turn) resolvedRounds += 1;
    }

    expect(resolvedRounds).toBeLessThan(200);
    expect(state.turnsLeft).toBe(0);
    expect(state.players.host.health).toBe(0);
    expect(state.players[easyId!].health).toBeGreaterThan(0);
    expect(state.ended).toBe(false);

    await expect(page.getByRole("button", { name: /Ghost · host · Support/ })).toBeVisible();
    await expect(page.getByTestId("multiplayer-turn-timer")).toHaveCount(0);
    await expect(easyPage.getByTestId("hard-turn-counter")).toHaveCount(0);

    const room = state.map.rooms.flat().find(candidate => candidate.id === state.players.host.roomId)!;
    const direction = (["north", "east", "south", "west"] as const)
      .find(candidate => room[candidate] === "open");
    expect(direction).toBeDefined();
    const moveTurn = state.turn;
    const [hardMove, easyMove] = await Promise.all([
      act("host", moveTurn, { type: "MOVE", target: direction! }),
      act(easyId!, moveTurn, { type: "MOVE", target: direction! }),
    ]);
    expect(hardMove.ok()).toBe(true);
    expect(easyMove.ok()).toBe(true);
    const afterBudgetActions = await poll(easyId!);
    expect(afterBudgetActions.state?.turn).toBe(moveTurn + 1);
    expect(afterBudgetActions.state?.players.host.health).toBe(0);
    expect(afterBudgetActions.state?.players[easyId!].health).toBeGreaterThan(0);
    expect(afterBudgetActions.state?.ended).toBe(false);
  } finally {
    await easyContext.close();
    if (roomCode) {
      await page.request.post("/api/multiplayer", { data: { type: "leave", code: roomCode, playerId: "host" } }).catch(() => undefined);
    }
  }
});
