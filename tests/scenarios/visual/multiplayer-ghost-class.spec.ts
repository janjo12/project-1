import { expect, test, type APIRequestContext } from "@playwright/test";

import type { MultiplayerState, PlayerAction } from "@/game/engine/multiplayer-rules";
import { openScenarioApp } from "../helpers";

type LiveRoomResponse = { code: string; playerId: string; revision: number; state: MultiplayerState | null };

async function readRoom(request: APIRequestContext, code: string, playerId: string) {
  const response = await request.get("/api/multiplayer", { params: { code, playerId } });
  expect(response.ok()).toBe(true);
  const room = await response.json() as LiveRoomResponse;
  expect(room.state).not.toBeNull();
  return room.state!;
}

async function takeTurn(request: APIRequestContext, code: string, state: MultiplayerState, actions: Record<string, PlayerAction>) {
  let latest: LiveRoomResponse | undefined;
  for (const playerId of Object.keys(state.players)) {
    const response = await request.post("/api/multiplayer", {
      data: { type: "action", code, playerId, turn: state.turn, action: actions[playerId] ?? { type: "SUPPORT" } },
    });
    expect(response.ok(), `${playerId} should submit turn ${state.turn}`).toBe(true);
    latest = await response.json() as LiveRoomResponse;
  }
  expect(latest?.state).not.toBeNull();
  return latest!.state!;
}

test("testghost multiplayer fixture confirms the ghost class rules", async ({ browser, page, request }) => {
  test.setTimeout(90_000);
  let roomCode = "";
  const guestContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const guestPage = await guestContext.newPage();

  try {
    await openScenarioApp(page, true);
    await page.getByRole("button", { name: "Multiplayer" }).click();
    await page.getByRole("button", { name: "Host game", exact: true }).click();
    roomCode = (await page.locator('[aria-label="Room code"]').textContent())?.trim() ?? "";
    expect(roomCode).not.toBe("");

    await guestPage.goto(new URL("/", page.url()).toString(), { waitUntil: "domcontentloaded" });
    await guestPage.getByRole("button", { name: "Multiplayer" }).click();
    await guestPage.getByRole("button", { name: "Join game", exact: true }).click();
    await guestPage.getByRole("textbox", { name: "Room code" }).fill(roomCode);
    await guestPage.getByRole("textbox", { name: "Room code" }).press("Enter");
    await expect(guestPage.getByText("Dungeon Run", { exact: true })).toBeVisible();
    await expect(guestPage.getByText("Multiplayer", { exact: true })).toHaveCount(0);
    await guestPage.getByRole("button", { name: "hard", exact: true }).click();
    await guestPage.getByRole("button", { name: "Left", exact: true }).click();
    await guestPage.getByRole("button", { name: "Off", exact: true }).click();
    const reducedMotion = guestPage.getByRole("switch", { name: "Reduced motion" });
    if (!(await reducedMotion.isChecked())) await reducedMotion.check();

    await page.getByRole("button", { name: "Game options", exact: true }).click();
    await page.getByRole("textbox", { name: "Seed" }).fill("testghost");
    await guestPage.getByRole("button", { name: "Start", exact: true }).click();
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(page.getByTestId("class-briefing")).toBeVisible();
    await expect(guestPage.getByTestId("class-briefing")).toBeVisible();
    await page.getByRole("button", { name: "Continue to practice", exact: true }).click();
    await page.getByRole("button", { name: "Start playing", exact: true }).click();
    await guestPage.getByRole("button", { name: "Start playing", exact: true }).click();

    let state = await readRoom(request, roomCode, "host");
    const ghost = state.players.host;
    const guestId = Object.keys(state.players).find(id => id !== "host");
    expect(guestId).toBeTruthy();
    expect(ghost).toMatchObject({ classId: "ghost", health: 0, roomId: "A1" });
    expect(state.players[guestId!].health).toBeGreaterThan(0);
    expect(state.players.host.gameplayOptions).toEqual({ difficulty: "easy", handedness: "right", microgamesEnabled: true, reducedMotion: false });
    expect(state.players[guestId!].gameplayOptions).toEqual({ difficulty: "hard", handedness: "left", microgamesEnabled: false, reducedMotion: true });
    expect(state.ended).toBe(false);

    // The ghost can deal damage and support the living ally.
    const zombie = state.map.entities.monsters["testghost:zombie"];
    expect(zombie.currentHealth).toBe(50);
    state = await takeTurn(request, roomCode, state, {
      host: { type: "ATTACK", target: zombie.id }, [guestId!]: { type: "SUPPORT" },
    });
    const zombieHealthAfterGhostAttack = state.map.entities.monsters[zombie.id].currentHealth;
    expect(zombieHealthAfterGhostAttack).toBeLessThanOrEqual(45);
    state = await takeTurn(request, roomCode, state, {
      host: { type: "SUPPORT", target: guestId! }, [guestId!]: { type: "ATTACK", target: zombie.id, microgameScore: 100 },
    });
    expect(state.players[guestId!].nextAttackBonus).toBe(0);
    expect(state.map.entities.monsters[zombie.id].currentHealth).toBeLessThan(zombieHealthAfterGhostAttack);

    // Ghost item/equipment actions are rejected before they can reveal closed chests.
    const itemChest = state.map.rooms.flat().find(room => room.id === "A1")!.contents.find(content => content.type === "item")!;
    const equipmentChest = state.map.rooms.flat().find(room => room.id === "A1")!.contents.find(content => content.type === "equipment")!;
    expect(itemChest.type).toBe("item");
    expect(equipmentChest.type).toBe("equipment");
    const itemResponse = await request.post("/api/multiplayer", { data: {
      type: "action", code: roomCode, playerId: "host", turn: state.turn, action: { type: "PICKUP", target: itemChest.id },
    } });
    expect(itemResponse.status()).toBe(403);
    const equipmentResponse = await request.post("/api/multiplayer", { data: {
      type: "action", code: roomCode, playerId: "host", turn: state.turn, action: { type: "PICKUP_EQUIPMENT", target: equipmentChest.id },
    } });
    expect(equipmentResponse.status()).toBe(403);
    const unchanged = await readRoom(request, roomCode, "host");
    expect(unchanged.map.rooms.flat().find(room => room.id === "A1")!.contents.find((content): content is Extract<typeof content, { type: "item" }> => content.type === "item" && content.id === itemChest.id)?.isChest).toBe(true);
    expect(unchanged.map.rooms.flat().find(room => room.id === "A1")!.contents.find((content): content is Extract<typeof content, { type: "equipment" }> => content.type === "equipment" && content.id === equipmentChest.id)?.isChest).toBe(true);

    // It can pass both a locked and guarded doorway, but not use the exit stairs.
    state = await takeTurn(request, roomCode, state, {
      host: { type: "MOVE", target: "east" }, [guestId!]: { type: "SUPPORT" },
    });
    expect(state.players.host.roomId).toBe("A2");
    expect(state.map.rooms.flat().find(room => room.id === "A2")!.east).toBe("guarded");
    state = await takeTurn(request, roomCode, state, {
      host: { type: "MOVE", target: "east" }, [guestId!]: { type: "SUPPORT" },
    });
    expect(state.players.host.roomId).toBe("A3");
    state = await takeTurn(request, roomCode, state, {
      host: { type: "MOVE", target: "east" }, [guestId!]: { type: "SUPPORT" },
    });
    expect(state.players.host.roomId).toBe("A4");
    expect(state.map.rooms.flat().find(room => room.id === "A4")!.contents.some(content => content.type === "stairs")).toBe(true);
    const descend = await request.post("/api/multiplayer", { data: {
      type: "action", code: roomCode, playerId: "host", turn: state.turn, action: { type: "DESCEND" },
    } });
    expect(descend.status()).toBe(403);
    expect((await readRoom(request, roomCode, "host")).level).toBe(1);
  } finally {
    if (roomCode) await request.post("/api/multiplayer", { data: { type: "leave", code: roomCode, playerId: "host" } }).catch(() => undefined);
    await guestContext.close();
  }
});
