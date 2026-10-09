import { PLAYER_MAX_ENERGY, useRunGame } from "@/game/engine/run-game-singleplayer";
import { createSeededDungeonMap } from "@/game/dungeon/generateDungeon";
import type { DungeonMap } from "@/game/dungeon/types";
import { getRoom } from "@/game/dungeon/rooms";
import { act, renderHook } from "@testing-library/react-native";

jest.mock("@/game/dungeon/mapStorage", () => ({
  createAndSaveSeededDungeonMap: jest.fn(async () => null),
  saveDungeonMap: jest.fn(async () => undefined),
  updateStoredDungeonMap: jest.fn(async () => null),
}));
jest.mock("@/game/engine/run-game-helpers", () => ({
  ...jest.requireActual("@/game/engine/run-game-helpers"),
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

async function setup(enemy = false, meal = false, enemyHealth = 20, enemyDamage = 2, difficulty: "easy" | "normal" | "hard" = "normal", seed = "charge-test", lockedDoor = false) {
  const map = fixture();
  if (lockedDoor) {
    getRoom(map, "A1")!.east = "locked";
    getRoom(map, "A2")!.west = "locked";
  }
  if (enemy) {
    map.entities.monsters.zombie = { id: "zombie", name: "Zombie", sprite: "🧟", type: "monster", currentHealth: enemyHealth, maximumHealth: enemyHealth, damage: enemyDamage };
    getRoom(map, "A1")!.contents = [{ id: "zombie", type: "monster" }];
  }
  if (meal) {
    map.entities.items.meal = { id: "meal", itemId: "energy-meal", label: "Energy Meal", sprite: "🍔", type: "item" };
    getRoom(map, "A1")!.contents.push({ id: "meal", type: "item" });
  }
  require("@/game/engine/run-game-helpers").createLevelMap.mockReturnValue(map);
  require("@/game/dungeon/mapStorage").createAndSaveSeededDungeonMap.mockResolvedValue(map);
  const hook = renderHook(() => useRunGame({ difficulty, istest: false, seed, vibrationEnabled: false, onGameOver: jest.fn() }));
  await act(async () => {});
  return hook;
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
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

test("a hard-mode timeout skips the action without generic defense or support", async () => {
  const { result } = await setup(true, false, 100, 20, "hard", "testwarrior");
  const health = result.current.playerHealth;
  act(() => result.current.toggleCharge());
  act(() => result.current.expireTurn());
  await act(async () => { jest.runAllTimers(); });
  expect(result.current.playerHealth).toBeLessThan(health);
  expect(result.current.dungeonMap.entities.monsters.zombie.currentHealth).toBe(100);
  expect(result.current.playerEnergy).toBe(PLAYER_MAX_ENERGY);
  expect(result.current.isCharged).toBe(false);
});

test("a hard-mode timeout still consumes warrior support when an enemy attacks", async () => {
  const { result } = await setup(true, false, 100, 20, "hard", "testwarrior");
  act(() => result.current.supportSelf());
  act(() => result.current.expireTurn());
  await act(async () => { jest.runAllTimers(); });
  expect(result.current.dungeonMap.entities.monsters.zombie.currentHealth).toBeLessThan(100);
});

test.each([
  ["Warrior", "testwarrior"],
  ["Cleric", "testcleric"],
  ["Thief", "testthief"],
] as const)("%s support works without charging and spends only its normal turn", async (_name, seed) => {
  const { result } = await setup(false, false, 20, 2, "easy", seed);
  const turn = result.current.turnNumber;
  act(() => result.current.supportSelf());
  expect(result.current.turnNumber).toBe(turn + 1);
  expect(result.current.playerEnergy).toBe(PLAYER_MAX_ENERGY);
  expect(result.current.isCharged).toBe(false);
});

test("charged Cleric support spends energy and restores health", async () => {
  const { result } = await setup(true, false, 100, 20, "easy", "testcleric");
  act(() => result.current.attackMonster("zombie"));
  await act(async () => { jest.runAllTimers(); });
  const healthBeforeSupport = result.current.playerHealth;
  expect(healthBeforeSupport).toBeLessThan(100);
  act(() => result.current.toggleCharge());
  act(() => result.current.supportSelf());
  expect(result.current.playerHealth).toBe(healthBeforeSupport + 10);
  await act(async () => { jest.runAllTimers(); });
  expect(result.current.playerHealth).toBe(healthBeforeSupport + 5);
  expect(result.current.playerEnergy).toBe(PLAYER_MAX_ENERGY - 10);
  expect(result.current.isCharged).toBe(false);
});

test("Cleric support grants five defense through its next turn", async () => {
  const { result } = await setup(true, false, 100, 20, "easy", "testcleric");
  act(() => result.current.supportSelf());
  await act(async () => { jest.runAllTimers(); });
  expect(result.current.playerHealth).toBe(95);
  expect(result.current.playerDefense).toBe(15);

  act(() => result.current.attackMonster("zombie"));
  await act(async () => { jest.runAllTimers(); });
  expect(result.current.playerHealth).toBe(90);
  expect(result.current.playerDefense).toBe(10);
});

test("charged Warrior support blocks the hit and counters the attacking enemy", async () => {
  const { result } = await setup(true, false, 100, 20, "easy", "testwarrior");
  act(() => result.current.toggleCharge());
  act(() => result.current.supportSelf());
  await act(async () => { jest.runAllTimers(); });

  expect(result.current.playerHealth).toBe(100);
  expect(result.current.dungeonMap.entities.monsters.zombie.currentHealth).toBe(80);
  expect(result.current.playerEnergy).toBe(PLAYER_MAX_ENERGY - 10);
});

test("an uncharged thief spends a turn picking a locked door without a key", async () => {
  const { result } = await setup(false, false, 20, 2, "easy", "testthief", true);
  const turn = result.current.turnNumber;
  expect(result.current.inventoryItem).toBeNull();

  await act(async () => { await result.current.moveToRoom("east"); });

  expect(result.current.currentRoomId).toBe("A1");
  expect(getRoom(result.current.dungeonMap, "A1")!.east).toBe("open");
  expect(result.current.inventoryItem).toBeNull();
  expect(result.current.turnNumber).toBe(turn + 1);
});

test("a charged thief picks a locked door without a key and moves through it", async () => {
  const { result } = await setup(false, false, 20, 2, "easy", "testthief", true);
  act(() => result.current.toggleCharge());
  await act(async () => { await result.current.moveToRoom("east"); });

  expect(result.current.currentRoomId).toBe("A2");
  expect(getRoom(result.current.dungeonMap, "A1")!.east).toBe("open");
  expect(result.current.inventoryItem).toBeNull();
  expect(result.current.isCharged).toBe(false);
});

test("thief support uses the uncharged and charged reward chances", async () => {
  const { result } = await setup(false, false, 20, 2, "easy", "testthief");
  const random = jest.spyOn(Math, "random").mockReturnValue(0.15);
  act(() => result.current.supportSelf());
  expect(result.current.inventoryItem).toBeNull();

  act(() => result.current.toggleCharge());
  act(() => result.current.supportSelf());
  expect(result.current.inventoryItem).not.toBeNull();
  expect(result.current.playerEnergy).toBe(PLAYER_MAX_ENERGY - 10);
  random.mockRestore();
});

test.each([
  ["Warrior", "testwarrior"],
  ["Cleric", "testcleric"],
  ["Thief", "testthief"],
] as const)("charged %s support consumes its charge", async (_name, seed) => {
  const { result } = await setup(false, false, 20, 2, "easy", seed);
  act(() => result.current.toggleCharge());
  act(() => result.current.supportSelf());
  expect(result.current.playerEnergy).toBe(PLAYER_MAX_ENERGY - 10);
  expect(result.current.isCharged).toBe(false);
});

test("empty energy cannot charge but the final reserved energy can be refunded", async () => {
  const { result } = await setup(true, false, 10000, 0, "easy");
  for (let n = 0; n < PLAYER_MAX_ENERGY / 10 - 1; n++) {
    act(() => result.current.toggleCharge());
    act(() => result.current.attackMonster("missing"));
    act(() => result.current.attackMonster("zombie"));
    await act(async () => { jest.runAllTimers(); });
  }
  act(() => result.current.toggleCharge());
  act(() => result.current.toggleCharge());
  expect(result.current.playerEnergy).toBe(10);
  expect(result.current.isCharged).toBe(false);
});


test("energy meal does not trigger while a charge reservation is refunded", async () => {
  const { result } = await setup(true, true, 10000, 0, "easy");
  await act(async () => { await result.current.pickupItem(); });
  await act(async () => { jest.runAllTimers(); });
  expect(result.current.inventoryItem).toBe("energy-meal");
  for (let n = 0; n < PLAYER_MAX_ENERGY / 10 - 1; n++) {
    act(() => result.current.toggleCharge());
    act(() => result.current.attackMonster("missing"));
    act(() => result.current.attackMonster("zombie"));
    await act(async () => { jest.runAllTimers(); });
  }
  act(() => result.current.toggleCharge());
  act(() => result.current.toggleCharge());
  expect(result.current.playerEnergy).toBe(10);
  expect(result.current.inventoryItem).toBe("energy-meal");
});
