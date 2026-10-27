import { canPressDoorway } from "@/components/Dungeon/Walls";
import {
    getInventoryItemActivationDescription,
    resolveEnergyLoss,
    resolveHealthLoss,
    resolveTurnLoss,
} from "@/game/engine/run-game-helpers";
import {
    applyWerewolfChaseAfterAction,
    getHardTurnLimit,
    getTurnDuration,
    hasTurnLimit,
    hasTurnTimer,
    runGameLoop,
    TURN_DURATION,
} from "@/game/engine/run-game-singleplayer";
import { createDungeonMap, createSeededDungeonMap } from "@/game/dungeon/generateDungeon";
import { createSeededRandom } from "@/game/dungeon/types";
import { getRoomSceneActors } from "@/game/engine/run-game-scene";
import { GAME_PARAMETERS } from "@/game/config/gameparameters";
import {
    directionDeltas,
    getNeighborInGrid,
    getReachableRoomIds,
    getRoomId,
    oppositeDirections,
    type Direction,
    type DungeonMap,
    type DungeonRoom,
    type WorldMonster,
} from "@/game/dungeon/types";
import { getActiveRooms, getRoom, getRoomMonster, moveWerewolfToRoom } from "@/game/dungeon/rooms";

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

function getRoomDistances(map: DungeonMap) {
  const distances = new Map<string, number>([[map.startingRoomId, 0]]);
  const queue = [map.startingRoomId];
  for (let index = 0; index < queue.length; index += 1) {
    const room = getRoom(map, queue[index]);
    for (const direction of Object.keys(directionDeltas) as Direction[]) {
      if (room[direction] === "wall") continue;
      const neighborPosition = getNeighborInGrid(map.rooms, room, direction);
      if (!neighborPosition) continue;
      const neighborId = getRoomId(neighborPosition);
      const neighbor = getRoom(map, neighborId);
      if (neighbor[oppositeDirections[direction]] === "wall") continue;
      if (distances.has(neighborId)) continue;
      distances.set(neighborId, distances.get(room.id)! + 1);
      queue.push(neighborId);
    }
  }
  return distances;
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
      equipment: {},
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

  it.each([1, 2, 5, 10])("keeps stairs rooms free of room monsters while showing doorway guards on level %i", level => {
    for (let seedIndex = 0; seedIndex < 12; seedIndex += 1) {
      const map = createSeededDungeonMap(`stairs-room-${level}-${seedIndex}`, level);
      const stairsRoom = map.rooms.flat().find(room => room.contents.some(content => content.type === "stairs"));
      const roomDistances = getRoomDistances(map);

      expect(stairsRoom).toBeDefined();
      expect(roomDistances.get(stairsRoom!.id)).toBe(Math.max(...roomDistances.values()));
      expect(stairsRoom!.contents.some(content => content.type === "monster")).toBe(false);
      const sceneEnemies = getRoomSceneActors({ currentMonsterId: null, dungeonMap: map, room: stairsRoom! })
        .filter(actor => actor.kind === "enemy");
      expect(sceneEnemies.every(actor => actor.position !== "center")).toBe(true);

      const entranceDirections = (Object.keys(directionDeltas) as Direction[]).filter(direction => stairsRoom![direction] !== "wall");
      expect(entranceDirections.length).toBeGreaterThan(0);
      for (const direction of entranceDirections) {
        const boundary = stairsRoom![direction];
        expect(["locked", "guarded"]).toContain(boundary);
        const neighborPosition = getNeighborInGrid(map.rooms, stairsRoom!, direction)!;
        const neighbor = getRoom(map, getRoomId(neighborPosition));
        expect(neighbor[oppositeDirections[direction]]).toBe(boundary);
        if (boundary === "guarded") {
          expect(Object.values(map.entities.doorwayGuards)).toEqual(expect.arrayContaining([
            expect.objectContaining({ roomId: neighbor.id, direction: oppositeDirections[direction] }),
          ]));
        }
      }
    }
  });

  it.each([1, 2, 5, 10])("places a chest or stairs in every dead end on level %i without increasing loot totals", level => {
    for (let seedIndex = 0; seedIndex < 24; seedIndex += 1) {
      const map = createSeededDungeonMap(`dead-end-loot-${level}-${seedIndex}`, level);
      const baselineMap = createDungeonMap(level, createSeededRandom(`dead-end-loot-${level}-${seedIndex}:level:${level}`));
      const rooms = getActiveRooms(map);
      const chestCount = rooms.reduce((count, room) => count + room.contents.filter(content =>
        (content.type === "item" || content.type === "equipment") && content.isChest,
      ).length, 0);
      const baselineChestCount = getActiveRooms(baselineMap).reduce((count, room) => count + room.contents.filter(content =>
        (content.type === "item" || content.type === "equipment") && content.isChest,
      ).length, 0);
      const deadEnds = rooms.filter(room => [room.north, room.east, room.south, room.west].filter(state => state !== "wall").length === 1);
      const stairsDeadEndCount = deadEnds.filter(room => room.contents.some(content => content.type === "stairs")).length;
      expect(chestCount).toBe(baselineChestCount);
      expect(deadEnds.length).toBeLessThanOrEqual(chestCount + stairsDeadEndCount);
      for (const room of deadEnds) {
        expect({ hasChestOrStairs: room.contents.some(content => content.type === "stairs" || ((content.type === "item" || content.type === "equipment") && content.isChest)), roomId: room.id, level, seedIndex }).toEqual({ hasChestOrStairs: true, roomId: room.id, level, seedIndex });
      }
    }
  });

  it("creates the complete first-level test dungeon only for the exact test seed", () => {
    const map = createSeededDungeonMap("test", 1, undefined, true);
    const stairsRoom = map.rooms.flat().find(room => room.contents.some(content => content.type === "stairs"))!;
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
    expect(Object.values(map.entities.monsters).filter((monster) => !monster.chases)).toHaveLength(4);
    const keyRoom = itemRooms.find(({ item }) => item === "key");
    expect(keyRoom).toBeDefined();
    const keyDoor = ["north", "east", "south", "west"].find((direction) =>
      getRoom(map, keyRoom!.roomId)[direction as "north" | "east" | "south" | "west"] === "locked",
    );
    expect(keyDoor).toBeDefined();
    expect(itemRooms).toHaveLength(5);
    expect(lockedBoundaries).toHaveLength(2);
    expect(getHardTurnLimit({ difficulty: "hard", map })).toBe(
      getActiveRooms(map).length * GAME_PARAMETERS.dungeon.hardTurnsPerRoom,
    );
    const sceneEnemies = getRoomSceneActors({ currentMonsterId: null, dungeonMap: map, room: stairsRoom })
      .filter(actor => actor.kind === "enemy");
    expect(sceneEnemies.every(actor => actor.position !== "center")).toBe(true);
    const stairsEntry = (Object.keys(directionDeltas) as Direction[]).find(direction => stairsRoom[direction] !== "wall");
    expect(stairsEntry).toBeDefined();
    expect(stairsRoom[stairsEntry!]).toBe("guarded");
    const stairsNeighbor = getRoom(map, getRoomId(getNeighborInGrid(map.rooms, stairsRoom, stairsEntry!)!));
    expect(Object.values(map.entities.doorwayGuards)).toEqual(expect.arrayContaining([
      expect.objectContaining({ roomId: stairsNeighbor.id, direction: oppositeDirections[stairsEntry!] }),
    ]));

    const secondLevel = createSeededDungeonMap("test", 2, undefined, true);
    expect(Object.keys(secondLevel.entities.items)).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/^test:/)]),
    );
  });

  it.each(["testwarrior", "testcleric", "testthief"])(
    "creates the same Level 1 test dungeon for %s",
    (seed) => {
      const reference = createSeededDungeonMap("test", 1, undefined, true);
      const actual = createSeededDungeonMap(seed, 1, undefined, true);
      expect(actual.startingRoomId).toBe("B5");
      expect(actual.columns.length * actual.rows.length).toBeLessThan(
        GAME_PARAMETERS.dungeon.mapWidthRooms * GAME_PARAMETERS.dungeon.mapHeightRooms,
      );
      expect(actual.rooms.flat()).toHaveLength(actual.columns.length * actual.rows.length);
      const layout = (map: DungeonMap) => ({
        startingRoomId: map.startingRoomId,
        rooms: map.rooms.flat().map(({ id, north, east, south, west, contents }) => ({
          id,
          north,
          east,
          south,
          west,
          contents: contents.map(({ id: contentId, type }) => ({ id: contentId, type })),
        })),
        items: Object.fromEntries(Object.entries(map.entities.items).map(([, item]) => [item.id.split(":").slice(1).join(":"), item.itemId])),
        monsters: Object.keys(map.entities.monsters).sort(),
      });

      expect(layout(actual)).toEqual(layout(reference));
    },
  );

  it("uses recovery items only when health or energy reaches zero", () => {
    expect(resolveHealthLoss(1, 1, "health-potion")).toEqual({
      nextHealth: 50,
      usesPotion: true,
    });
    expect(resolveHealthLoss(2, 1, "health-potion")).toEqual({
      nextHealth: 1,
      usesPotion: false,
    });
    expect(resolveEnergyLoss(1, 1, "energy-meal")).toEqual({
      nextEnergy: 50,
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

  it("bases the hard turn limit on active rooms in the real level map", () => {
    expect(
      getHardTurnLimit({
        difficulty: "hard",
        map: createTestMap(),
      }),
    ).toBe(8);
    expect(
      getHardTurnLimit({
        difficulty: "normal",
        map: createTestMap(),
      }),
    ).toBe(8);
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
        turnDuration: 2500,
      },
    };

    runGameLoop(entities, { time: { delta: 200 } } as never);

    expect(entities.gameLoop.elapsed).toBe(2500);
    expect(onFrame).toHaveBeenCalledWith(200, 0);
    expect(onExpire).toHaveBeenCalledTimes(1);
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
