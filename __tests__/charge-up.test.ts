import { GAME_PARAMETERS } from "@/gameparameters";
import { PLAYER_MAX_ENERGY, useRunGame } from "@/hooks/run-game-singleplayer";
import { createSeededDungeonMap } from "@/utils/dungeon-generation";
import type { DungeonMap } from "@/utils/dungeon-map";
import { getRoom } from "@/utils/dungeon-map-runtime";
import { act, renderHook } from "@testing-library/react-native";

jest.mock("@/utils/dungeon-map-storage", () => ({
  createAndSaveSeededDungeonMap: jest.fn(async () => null),
  saveDungeonMap: jest.fn(async () => undefined),
  updateStoredDungeonMap: jest.fn(async () => null),
}));
jest.mock("@/hooks/run-game-helpers", () => ({
  ...jest.requireActual("@/hooks/run-game-helpers"),
  createLevelMap: jest.fn(),
}));

function fixture(): DungeonMap {
  const map = createSeededDungeonMap("charge-test", 1);
  map.rooms.flat().forEach(room => {
    room.contents = [];
    room.north = room.south = room.east = room.west = "wall";
    room.isCurrentPosition = room.id === "A1";
  });
  map.startingRoomId = "A1";
  map.entities = { items: {}, equipment: {}, monsters: {}, doorwayGuards: {} };
  getRoom(map, "A1")!.east = "open";
  getRoom(map, "A2")!.west = "open";
  return map;
}

async function setup(enemy = false, meal = false, enemyHealth = 20, enemyDamage = 2) {
  const map = fixture();
  if (enemy) {
    map.entities.monsters.zombie = { id: "zombie", name: "Zombie", sprite: "🧟", type: "monster", currentHealth: enemyHealth, maximumHealth: enemyHealth, damage: enemyDamage };
    getRoom(map, "A1")!.contents = [{ id: "zombie", type: "monster" }];
  }
  if (meal) {
    map.entities.items.meal = { id: "meal", itemId: "energy-meal", label: "Energy Meal", sprite: "🍔", type: "item" };
    getRoom(map, "A1")!.contents.push({ id: "meal", type: "item" });
  }
  require("@/hooks/run-game-helpers").createLevelMap.mockReturnValue(map);
  require("@/utils/dungeon-map-storage").createAndSaveSeededDungeonMap.mockResolvedValue(map);
  const hook = renderHook(() => useRunGame({ difficulty: "normal", seed: "charge-test", vibrationEnabled: false, onGameOver: jest.fn() }));
  await act(async () => {});
  return hook;
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test("map dimensions match designer parameters", () => {
  const map = fixture();
  expect(map.rows).toHaveLength(GAME_PARAMETERS.dungeon.mapWidthRooms);
  expect(map.columns).toHaveLength(GAME_PARAMETERS.dungeon.mapHeightRooms);
  expect(map.rows.length).toBeGreaterThan(map.columns.length);
});

test("charge can be cancelled and re-enabled without advancing the turn", async () => {
  const { result } = await setup();
  for (let n = 0; n < 3; n++) {
    act(() => result.current.toggleCharge());
    expect(result.current.playerEnergy).toBe(PLAYER_MAX_ENERGY - 10);
    expect(result.current.isCharged).toBe(true);
    act(() => result.current.toggleCharge());
    expect(result.current.playerEnergy).toBe(PLAYER_MAX_ENERGY);
    expect(result.current.isCharged).toBe(false);
  }
  expect(result.current.turnNumber).toBe(0);
});

test("blocked moves keep charge; valid moves cancel it and always consume a turn", async () => {
  const { result } = await setup();
  const turns = result.current.hardTurnCounter;
  act(() => result.current.toggleCharge());
  await act(async () => { await result.current.moveToRoom("north"); });
  expect(result.current.isCharged).toBe(true);
  await act(async () => { await result.current.moveToRoom("east"); });
  expect(result.current.isCharged).toBe(false);
  expect(result.current.hardTurnCounter).toBe(turns! - 1);
  expect(result.current.playerEnergy).toBe(PLAYER_MAX_ENERGY);
  await act(async () => { await result.current.moveToRoom("west"); });
  expect(result.current.hardTurnCounter).toBe(turns! - 2);
});

test("charged pickup refunds energy and takes its normal turn", async () => {
  const { result } = await setup(false, true);
  const turns = result.current.hardTurnCounter;
  act(() => result.current.toggleCharge());

  await act(async () => { await result.current.pickupItem(); });

  expect(result.current.isCharged).toBe(false);
  expect(result.current.playerEnergy).toBe(PLAYER_MAX_ENERGY);
  expect(result.current.hardTurnCounter).toBe(turns! - 1);
});

test("normal attacks are free; charged attacks hit harder without a second energy cost", async () => {
  const { result } = await setup(true);
  act(() => result.current.attackMonster("zombie"));
  await act(async () => { jest.runAllTimers(); });
  expect(result.current.dungeonMap.entities.monsters.zombie.currentHealth).toBe(10);
  expect(result.current.playerEnergy).toBe(PLAYER_MAX_ENERGY);
  act(() => result.current.toggleCharge());
  act(() => result.current.attackMonster("missing"));
  expect(result.current.isCharged).toBe(true);
  act(() => result.current.attackMonster("zombie"));
  act(() => result.current.toggleCharge());
  expect(result.current.isCharged).toBe(true);
  await act(async () => { jest.runAllTimers(); });
  expect(result.current.dungeonMap.entities.monsters.zombie.currentHealth).toBe(0);
  expect(result.current.playerEnergy).toBe(PLAYER_MAX_ENERGY - 10);
  expect(result.current.isCharged).toBe(false);
});

test("charged defense blocks damage and doubles counterattack", async () => {
  const { result } = await setup(true);
  const health = result.current.playerHealth;
  act(() => result.current.toggleCharge());
  act(() => result.current.defend());
  await act(async () => { jest.runAllTimers(); });
  expect(result.current.playerHealth).toBe(health);
  expect(result.current.dungeonMap.entities.monsters.zombie.currentHealth).toBe(18);
  expect(result.current.isCharged).toBe(false);
});

test("empty energy cannot charge but the final reserved energy can be refunded", async () => {
  const { result } = await setup(true, false, 10000, 0);
  for (let n = 0; n < PLAYER_MAX_ENERGY / 10; n++) {
    act(() => result.current.toggleCharge());
    act(() => result.current.attackMonster("missing"));
    act(() => result.current.attackMonster("zombie"));
    await act(async () => { jest.runAllTimers(); });
  }
  expect(result.current.playerEnergy).toBe(10);
  expect(result.current.isCharged).toBe(false);
});


test("energy meal does not trigger while a charge reservation is refunded", async () => {
  const { result } = await setup(true, true, 10000, 0);
  await act(async () => { await result.current.pickupItem(); });
  await act(async () => { jest.runAllTimers(); });
  expect(result.current.inventoryItem).toBe("energy-meal");
  for (let n = 0; n < PLAYER_MAX_ENERGY / 10; n++) {
    act(() => result.current.toggleCharge());
    act(() => result.current.attackMonster("missing"));
    act(() => result.current.attackMonster("zombie"));
    await act(async () => { jest.runAllTimers(); });
  }
  expect(result.current.playerEnergy).toBe(20);
  expect(result.current.inventoryItem).toBe("energy-meal");
});
