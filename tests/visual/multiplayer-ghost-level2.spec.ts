import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { getNeighbor, getRoomId, type Direction, type DungeonMap, type DungeonRoom } from "@/game/dungeon/types";
import type { MultiplayerState, PlayerAction } from "@/game/engine/multiplayer-rules";

const DIRECTIONS: Direction[] = ["north", "east", "south", "west"];

type LiveRoomResponse = {
  code: string;
  playerId: string;
  revision: number;
  state: MultiplayerState | null;
};

async function readRoom(request: APIRequestContext, code: string, playerId: string) {
  const response = await request.get("/api/multiplayer", { params: { code, playerId } });
  expect(response.ok(), "the live multiplayer room should remain available").toBe(true);
  const room = await response.json() as LiveRoomResponse;
  expect(room.state, "the room should have a running shared state").not.toBeNull();
  return room.state!;
}

async function takeTurn(
  request: APIRequestContext,
  code: string,
  state: MultiplayerState,
  actions: Record<string, PlayerAction>,
) {
  let resolved: LiveRoomResponse | null = null;
  for (const playerId of Object.keys(state.players)) {
    const response = await request.post("/api/multiplayer", {
      data: { type: "action", code, playerId, turn: state.turn, action: actions[playerId] ?? { type: "SUPPORT" } },
    });
    expect(response.ok(), `player ${playerId} should be allowed to submit turn ${state.turn}`).toBe(true);
    resolved = await response.json() as LiveRoomResponse;
  }
  expect(resolved?.state, "the server should resolve after every player submits").not.toBeNull();
  return resolved!.state!;
}

function getRoom(map: DungeonMap, id: string): DungeonRoom {
  const room = map.rooms.flat().find(candidate => candidate.id === id);
  if (!room) throw new Error(`Room ${id} is missing from the live dungeon map`);
  return room;
}

function findPath(map: DungeonMap, start: string, target: string) {
  const queue = [start];
  const previous = new Map<string, { roomId: string; direction: Direction } | null>([[start, null]]);

  for (let index = 0; index < queue.length; index += 1) {
    const roomId = queue[index];
    if (roomId === target) break;
    const room = getRoom(map, roomId);
    for (const direction of DIRECTIONS) {
      if (room[direction] === "wall") continue;
      const neighbor = getNeighbor(room, direction);
      if (!neighbor) continue;
      const nextId = getRoomId(neighbor);
      if (previous.has(nextId) || !map.rooms.flat().some(candidate => candidate.id === nextId)) continue;
      previous.set(nextId, { roomId, direction });
      queue.push(nextId);
    }
  }

  if (!previous.has(target)) throw new Error(`No room path from ${start} to ${target}`);
  const path: Array<{ from: string; to: string; direction: Direction }> = [];
  let current = target;
  while (current !== start) {
    const step = previous.get(current);
    if (!step) throw new Error(`Incomplete path to ${target}`);
    path.unshift({ from: step.roomId, to: current, direction: step.direction });
    current = step.roomId;
  }
  return path;
}

function reverseDirection(direction: Direction): Direction {
  return { north: "south", east: "west", south: "north", west: "east" }[direction] as Direction;
}

async function waitForVisibleRoom(page: Page, id: string) {
  await expect(page.getByTestId(`map-room-${id}`)).toBeVisible({ timeout: 10_000 });
}

test("two live multiplayer players reach Level 2 after a ghost reveals and supports the survivor", async ({ browser, page, request }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  let roomCode = "";
  let hostId = "";
  const guestContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const guestPage = await guestContext.newPage();

  try {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole("button", { name: "Multiplayer" }).click();
    await page.getByRole("button", { name: "Host game", exact: true }).click();
    await expect(page.getByText("Room code", { exact: true })).toBeVisible();
    roomCode = (await page.locator('[aria-label="Room code"]').textContent())?.trim() ?? "";
    expect(roomCode).not.toBe("");

    await guestPage.goto(new URL("/", page.url()).toString());
    await guestPage.getByRole("button", { name: "Multiplayer" }).click();
    await guestPage.getByRole("button", { name: "Join game", exact: true }).click();
    await guestPage.getByRole("textbox", { name: "Room code" }).fill(roomCode);
    await guestPage.getByRole("button", { name: "Join room", exact: true }).click();
    await expect(guestPage.getByText(new RegExp(`Joined room ${roomCode}`))).toBeVisible();

    await page.getByRole("button", { name: "Game options", exact: true }).click();
    await page.getByRole("textbox", { name: "Seed" }).fill("testwarrior");
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(page.getByTestId("class-briefing")).toBeVisible();
    await expect(guestPage.getByTestId("class-briefing")).toBeVisible();
    await page.getByRole("button", { name: "Next class instructions", exact: true }).click();
    await guestPage.getByRole("button", { name: "Next class instructions", exact: true }).click();
    await page.getByRole("button", { name: "Start playing", exact: true }).click();
    await guestPage.getByRole("button", { name: "Start playing", exact: true }).click();

    let state = await readRoom(request, roomCode, "host");
    hostId = "host";
    const guestId = Object.keys(state.players).find(id => id !== hostId);
    expect(guestId).toBeTruthy();
    const victimId = guestId!;
    expect(state.phase).toBe("playing");
    expect(state.players.host.classId).toBe("warrior");
    expect(state.players[victimId].classId).toBe("warrior");

    const wolfId = Object.values(state.map.entities.monsters).find(monster => monster.chases)?.id;
    expect(wolfId, "the reserved multiplayer seed includes a Werewolf encounter").toBeTruthy();
    const wolfRoomId = wolfId!.split(":")[0];
    const stairsRoomId = state.map.rooms.flat().find(room => room.contents.some(content => content.type === "stairs"))?.id;
    expect(stairsRoomId).toBeTruthy();
    const pathToWolf = findPath(state.map, state.players.host.roomId, wolfRoomId);
    const finalWolfStep = pathToWolf[pathToWolf.length - 1];
    expect(finalWolfStep).toBeTruthy();

    // Travel through the real test floor, collect the key, give the guest a health potion,
    // and let the host carry the Silver Bullet for the final Werewolf encounter.
    for (let stepIndex = 0; stepIndex < pathToWolf.length; stepIndex += 1) {
      const currentRoomId = state.players.host.roomId;
      expect(state.players[victimId].roomId).toBe(currentRoomId);
      if (currentRoomId === wolfRoomId) break;
      const step = pathToWolf[stepIndex];
      expect(step.from).toBe(currentRoomId);
      const room = getRoom(state.map, currentRoomId);
      const guard = Object.values(state.map.entities.doorwayGuards).find(candidate =>
        candidate.roomId === currentRoomId && candidate.direction === step.direction &&
        (state.map.entities.monsters[candidate.monsterId]?.currentHealth ?? 0) > 0,
      );

      if (guard) {
        state = await takeTurn(request, roomCode, state, {
          host: { type: "ATTACK", target: guard.monsterId, microgameScore: 100 },
          [victimId]: { type: "ATTACK", target: guard.monsterId, microgameScore: 100 },
        });
        stepIndex -= 1;
        continue;
      }

      const groundItem = room.contents.find((content): content is Extract<typeof content, { type: "item" }> => content.type === "item");
      const item = groundItem ? state.map.entities.items[groundItem.id] : undefined;
      if (item?.itemId === "key" && !state.players.host.item) {
        state = await takeTurn(request, roomCode, state, {
          host: { type: "PICKUP", target: item.id },
          [victimId]: { type: "SUPPORT" },
        });
        stepIndex -= 1;
        continue;
      }
      if (item?.itemId === "health-potion" && !state.players[victimId].item) {
        state = await takeTurn(request, roomCode, state, {
          host: { type: "SUPPORT" },
          [victimId]: { type: "PICKUP", target: item.id },
        });
        stepIndex -= 1;
        continue;
      }
      if (item?.itemId === "silver-bullet" && !state.players.host.item) {
        state = await takeTurn(request, roomCode, state, {
          host: { type: "PICKUP", target: item.id },
          [victimId]: { type: "SUPPORT" },
        });
        stepIndex -= 1;
        continue;
      }

      const nextRoom = getRoom(state.map, step.to);
      if (room[step.direction] === "locked") expect(state.players.host.item).toBe("key");
      if (room[step.direction] === "wall") throw new Error(`The test route unexpectedly hit a wall at ${currentRoomId}`);
      expect(nextRoom.id).toBe(step.to);
      state = await takeTurn(request, roomCode, state, {
        host: { type: "MOVE", target: step.direction },
        [victimId]: { type: "MOVE", target: step.direction },
      });
    }

    expect(state.players.host.roomId).toBe(wolfRoomId);
    expect(state.players[victimId].roomId).toBe(wolfRoomId);
    expect(state.players.host.item).toBe("silver-bullet");
    expect(state.players[victimId].item).toBe("health-potion");

    // The guest keeps attacking the immune Werewolf while the host waits safely next door.
    // This makes the guest's death a real consequence of live combat; the health potion saves once.
    const retreatDirection = reverseDirection(finalWolfStep.direction);
    for (let hit = 0; state.players[victimId].health > 0 && hit < 18; hit += 1) {
      state = await takeTurn(request, roomCode, state, {
        host: hit === 0 ? { type: "MOVE", target: retreatDirection } : { type: "SUPPORT" },
        [victimId]: { type: "ATTACK", target: wolfId!, microgameScore: 100 },
      });
    }
    expect(state.players[victimId].health, "the Werewolf should kill the player who keeps attacking without the Silver Bullet").toBe(0);
    expect(state.players.host.health).toBeGreaterThan(0);
    await expect(guestPage.getByText(/You are a ghost/)).toBeVisible();

    // Ghost movement reveals a room ahead without drawing enemy attacks.
    const stairsPath = findPath(state.map, wolfRoomId, stairsRoomId!);
    expect(stairsPath.length).toBeGreaterThan(0);
    const ghostForward = stairsPath[0];
    const wolf = state.map.entities.monsters[wolfId!];
    expect(wolf.currentHealth).toBe(1);
    state = await takeTurn(request, roomCode, state, {
      host: { type: "SUPPORT" },
      [victimId]: { type: "MOVE", target: ghostForward.direction },
    });
    expect(state.players[victimId].roomId).toBe(ghostForward.to);
    expect(getRoom(state.map, ghostForward.to).isRevealed).toBe(true);
    await waitForVisibleRoom(page, ghostForward.to);

    // Bring the host to the Werewolf and let the ghost's support accompany the Silver Bullet hit.
    const directionToWolf = reverseDirection(ghostForward.direction);
    state = await takeTurn(request, roomCode, state, {
      host: { type: "MOVE", target: finalWolfStep.direction },
      [victimId]: { type: "MOVE", target: directionToWolf },
    });
    expect(state.players.host.roomId).toBe(wolfRoomId);
    expect(state.players[victimId].roomId).toBe(wolfRoomId);
    state = await takeTurn(request, roomCode, state, {
      host: { type: "ATTACK", target: wolfId!, microgameScore: 100 },
      [victimId]: { type: "SUPPORT", target: "host" },
    });
    expect(state.map.entities.monsters[wolfId!].currentHealth).toBe(0);
    expect(state.players.host.nextAttackBonus).toBe(0);

    const directionToStairs = stairsPath[0].direction;
    state = await takeTurn(request, roomCode, state, {
      host: { type: "MOVE", target: directionToStairs },
      [victimId]: { type: "MOVE", target: directionToStairs },
    });
    expect(state.players.host.roomId).toBe(stairsRoomId);
    expect(state.players[victimId].roomId).toBe(stairsRoomId);
    await expect(page.getByRole("button", { name: new RegExp(`Warrior.*${victimId}`) })).toBeVisible();

    // A ghost can support the living player on the stairs, then the host descends to Level 2.
    state = await takeTurn(request, roomCode, state, {
      host: { type: "DESCEND" },
      [victimId]: { type: "SUPPORT", target: "host" },
    });
    expect(state.level).toBe(2);
    expect(state.players.host.nextAttackBonus).toBe(5);
    expect(state.players[victimId].health).toBeGreaterThan(0);
    expect(state.players[victimId].roomId).toBe(state.players.host.roomId);
    await expect(page.getByText(/^TEST · Level 2 ·/)).toBeVisible();
    await expect(guestPage.getByText(/You are a ghost/)).toHaveCount(0);
  } finally {
    if (roomCode && hostId) {
      await request.post("/api/multiplayer", { data: { type: "leave", code: roomCode, playerId: hostId } }).catch(() => undefined);
    }
    await guestContext.close();
  }
});
