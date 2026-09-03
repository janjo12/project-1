import {
  applyWerewolfChaseAfterAction,
  getHardTurnLimit,
  getEnemyAttackOutcome,
  getTurnDuration,
  hasTurnLimit,
  hasTurnTimer,
  runGameLoop,
  TURN_DURATION,
} from "@/hooks/run-game";
import {
  getInventoryItemActivationDescription,
  resolveEnergyLoss,
  resolveHealthLoss,
  resolveTurnLoss,
} from "@/hooks/run-game-helpers";
import { canPressDoorway } from "@/components/room-walls";
import { createSeededDungeonMap } from "@/utils/dungeon-generation";
import {
  type DungeonMap,
  type DungeonRoom,
  type WorldMonster,
} from "@/utils/dungeon-map";
import { getRoom, getRoomMonster, moveWerewolfToRoom } from "@/utils/dungeon-map-runtime";

function createRoom(
  id: string,
  column: string,
  row: number,
  overrides: Partial<DungeonRoom> = {},
): DungeonRoom {
  return {
    column,
    contents: [],
    east: "wall",
    id,
    isCurrentPosition: false,
    isRevealed: false,
    north: "wall",
    row,
    south: "wall",
    west: "wall",
    ...overrides,
  };
}

function createTestMap(): DungeonMap {
  const startingRoom = createRoom("A1", "A", 1, {
    east: "open",
    isCurrentPosition: true,
    isRevealed: true,
  });
  const connectedRoom = createRoom("A2", "A", 2, {
    isRevealed: true,
    west: "open",
  });
  const inactiveRoom = createRoom("B1", "B", 1);
  const inactiveRoomWithNoConnection = createRoom("B2", "B", 2);

  return {
    columns: ["A", "B"],
    entities: {
      doorwayGuards: {},
      items: {},
      monsters: {},
    },
    level: 1,
    rooms: [
      [startingRoom, connectedRoom],
      [inactiveRoom, inactiveRoomWithNoConnection],
    ],
    rows: [1, 2],
    startingRoomId: startingRoom.id,
  };
}

function addMonster(
  map: DungeonMap,
  id: string,
  overrides: Partial<WorldMonster> = {},
) {
  const maximumHealth = overrides.maximumHealth ?? 2;

  map.entities.monsters[id] = {
    currentHealth: maximumHealth,
    damage: 1,
    id,
    maximumHealth,
    name: "Zombie",
    sprite: "z",
    type: "monster",
    ...overrides,
  };
}

function addWerewolf(map: DungeonMap, id = "B1:werewolf") {
  addMonster(map, id, {
    chases: true,
    currentHealth: 1,
    maximumHealth: 1,
    name: "Werewolf",
    sprite: "w",
  });
}

describe("run-game policies", () => {
  it("gives Normal a turn limit and adds the per-turn timer only on Hard", () => {
    expect(hasTurnLimit("easy")).toBe(false);
    expect(hasTurnTimer("easy")).toBe(false);
    expect(hasTurnLimit("normal")).toBe(true);
    expect(hasTurnTimer("normal")).toBe(false);
    expect(hasTurnLimit("hard")).toBe(true);
    expect(hasTurnTimer("hard")).toBe(true);
  });

  it("allows a locked doorway press only when the player holds a key", () => {
    expect(canPressDoorway("locked", true)).toBe(true);
    expect(canPressDoorway("locked", false)).toBe(false);
    expect(canPressDoorway("guarded", true)).toBe(false);
  });

  it("creates the complete first-level test dungeon only for the exact test seed", () => {
    const map = createSeededDungeonMap("test", 1, undefined, true);
    const itemRooms = map.rooms.flat().flatMap((room) =>
      room.contents
        .filter((content) => content.type === "item")
        .map((content) => ({ item: map.entities.items[content.id]?.itemId, roomId: room.id })),
    );
    const itemTypes = itemRooms.map(({ item }) => item);
    const werewolfRoom = map.rooms.flat().find((room) =>
      room.contents.some(
        (content) => content.type === "monster" && map.entities.monsters[content.id]?.chases,
      ),
    );
    const lockedBoundaries = map.rooms
      .flat()
      .flatMap((room) => [room.north, room.east, room.south, room.west])
      .filter((boundary) => boundary === "locked");

    expect(itemTypes).toEqual(
      expect.arrayContaining([
        "energy-meal",
        "health-potion",
        "key",
        "silver-bullet",
        "clock",
      ]),
    );
    expect(new Set(itemRooms.map(({ roomId }) => roomId)).size).toBe(itemRooms.length);
    expect(itemRooms.some(({ roomId }) => roomId === werewolfRoom?.id)).toBe(false);
    expect(werewolfRoom).toBeDefined();
    expect(lockedBoundaries.length).toBeGreaterThanOrEqual(2);

    const secondLevel = createSeededDungeonMap("test", 2, undefined, true);
    expect(Object.keys(secondLevel.entities.items)).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/^test:/)]),
    );
  });

  it("uses recovery items only when health or energy reaches zero", () => {
    expect(resolveHealthLoss(1, 1, "health-potion")).toEqual({
      nextHealth: 5,
      usesPotion: true,
    });
    expect(resolveHealthLoss(2, 1, "health-potion")).toEqual({
      nextHealth: 1,
      usesPotion: false,
    });
    expect(resolveEnergyLoss(1, 1, "energy-meal")).toEqual({
      nextEnergy: 3,
      usesMeal: true,
    });
  });

  it("uses a clock before turn-limit game over and grants 5 + level turns", () => {
    expect(resolveTurnLoss(1, "clock", 4)).toEqual({
      nextCounter: 9,
      usesClock: true,
    });
    expect(resolveTurnLoss(1, null, 4)).toEqual({
      nextCounter: 0,
      usesClock: false,
    });
  });

  it("explains when each held item activates automatically", () => {
    expect(getInventoryItemActivationDescription("silver-bullet")).toContain(
      "attack a werewolf",
    );
    expect(getInventoryItemActivationDescription("key")).toContain("locked door");
  });

  it("can be imported without evaluating map-dependent policies at module load", () => {
    expect(typeof runGameLoop).toBe("function");
  });

  it("bases the hard turn limit on active rooms in the real level map", () => {
    expect(
      getHardTurnLimit({
        difficulty: "hard",
        map: createTestMap(),
      }),
    ).toBe(6);
    expect(
      getHardTurnLimit({
        difficulty: "normal",
        map: createTestMap(),
      }),
    ).toBe(6);
  });

  it("lets the turn duration depend on difficulty and level", () => {
    expect(getTurnDuration({ difficulty: "normal", level: 1 })).toBe(
      TURN_DURATION,
    );
    expect(getTurnDuration({ difficulty: "hard", level: 2 })).toBe(4970);
  });

  it("uses the game loop entity turn duration instead of a module constant", () => {
    const onExpire = jest.fn();
    const onFrame = jest.fn();
    const entities = {
      gameLoop: {
        elapsed: 2400,
        expired: false,
        isTurnClockActive: () => true,
        onExpire,
        onFrame,
        resetKey: 0,
        turnDuration: 2500,
      },
    };

    runGameLoop(entities, { time: { delta: 200 } } as never);

    expect(entities.gameLoop.elapsed).toBe(2500);
    expect(onFrame).toHaveBeenCalledWith(200, 0);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("halves defended damage and enables the weak counterattack", () => {
    expect(
      getEnemyAttackOutcome({ isDefending: true, monsterDamage: 3 }),
    ).toEqual({ counterattackDamage: 1, damageTaken: 2 });
    expect(
      getEnemyAttackOutcome({ isDefending: false, monsterDamage: 3 }),
    ).toEqual({ counterattackDamage: 0, damageTaken: 3 });
  });

  it("moves the existing werewolf into the target room", () => {
    const map = createTestMap();

    addMonster(map, "A2:monster");
    addWerewolf(map);
    map.rooms[0][1].contents = [{ id: "A2:monster", type: "monster" }];
    map.rooms[1][0].contents = [{ id: "B1:werewolf", type: "monster" }];

    const nextMap = moveWerewolfToRoom(map, "A2");
    const targetRoom = getRoom(nextMap, "A2");
    const werewolfRefs = nextMap.rooms
      .flat()
      .flatMap((room) => room.contents)
      .filter(
        (content) => content.type === "monster" && content.id === "B1:werewolf",
      );

    expect(werewolfRefs).toHaveLength(1);
    expect(targetRoom?.contents).toContainEqual({
      id: "A2:monster",
      type: "monster",
    });
    expect(targetRoom?.contents[targetRoom.contents.length - 1]).toEqual({
      id: "B1:werewolf",
      type: "monster",
    });
  });

  it("moves the aggroed werewolf after a non-move action in an empty room", () => {
    const map = createTestMap();

    addWerewolf(map);
    map.rooms[1][0].contents = [{ id: "B1:werewolf", type: "monster" }];

    const nextMap = applyWerewolfChaseAfterAction({
      hasEncounteredWerewolf: true,
      map,
      roomId: "A1",
    });

    expect(getRoomMonster(nextMap, getRoom(nextMap, "A1"))?.name).toBe(
      "Werewolf",
    );
  });

  it("does not move the werewolf before it has been aggroed", () => {
    const map = createTestMap();

    addWerewolf(map);
    map.rooms[1][0].contents = [{ id: "B1:werewolf", type: "monster" }];

    const nextMap = applyWerewolfChaseAfterAction({
      hasEncounteredWerewolf: false,
      map,
      roomId: "A1",
    });

    expect(getRoomMonster(nextMap, getRoom(nextMap, "A1"))).toBeNull();
    expect(getRoomMonster(nextMap, getRoom(nextMap, "B1"))?.name).toBe(
      "Werewolf",
    );
  });
});
