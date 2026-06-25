import {
  applyWerewolfChaseAfterAction,
  getHardTurnLimit,
  getTurnDuration,
  runGameLoop,
  TURN_DURATION,
} from "@/hooks/run-game";
import {
  damageMonsterInRoom,
  getRoom,
  getRoomMonster,
  getTargetableMonsters,
  moveWerewolfToRoom,
  prioritizeRoomContentsForTargeting,
  type DungeonMap,
  type DungeonRoom,
} from "@/utils/dungeon-map";

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

describe("run-game policies", () => {
  it("can be imported without evaluating map-dependent policies at module load", () => {
    expect(typeof runGameLoop).toBe("function");
  });

  it("bases the hard turn limit on active rooms in the real level map", () => {
    expect(
      getHardTurnLimit({
        difficulty: "hard",
        level: 1,
        map: createTestMap(),
        seed: "test-seed",
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

  it("moves the existing werewolf into the target room", () => {
    const map = createTestMap();

    map.entities.monsters["A2:monster"] = {
      currentHealth: 2,
      damage: 1,
      id: "A2:monster",
      maximumHealth: 2,
      name: "Zombie",
      sprite: "z",
      type: "monster",
    };
    map.entities.monsters["B1:werewolf"] = {
      chases: true,
      currentHealth: 1,
      damage: 1,
      id: "B1:werewolf",
      maximumHealth: 1,
      name: "Werewolf",
      sprite: "w",
      type: "monster",
    };
    map.rooms[0][1].contents = [{ id: "A2:monster", type: "monster" }];
    map.rooms[1][0].contents = [{ id: "B1:werewolf", type: "monster" }];

    const nextMap = moveWerewolfToRoom(map, "A2");
    const targetRoom = getRoom(nextMap, "A2");
    const werewolfRefs = nextMap.rooms
      .flat()
      .flatMap((room) => room.contents)
      .filter((content) => content.type === "monster" && content.id === "B1:werewolf");

    expect(werewolfRefs).toHaveLength(1);
    expect(targetRoom?.contents).toContainEqual({
      id: "A2:monster",
      type: "monster",
    });
    expect(targetRoom?.contents.at(-1)).toEqual({
      id: "B1:werewolf",
      type: "monster",
    });
  });

  it("targets non-werewolf enemies before the werewolf when both are in the room", () => {
    const map = createTestMap();

    map.entities.monsters["A1:monster"] = {
      currentHealth: 2,
      damage: 1,
      id: "A1:monster",
      maximumHealth: 2,
      name: "Zombie",
      sprite: "z",
      type: "monster",
    };
    map.entities.monsters["B1:werewolf"] = {
      chases: true,
      currentHealth: 1,
      damage: 1,
      id: "B1:werewolf",
      maximumHealth: 1,
      name: "Werewolf",
      sprite: "w",
      type: "monster",
    };
    map.rooms[0][0].contents = [
      { id: "B1:werewolf", type: "monster" },
      { id: "A1:monster", type: "monster" },
    ];

    expect(getRoomMonster(map, getRoom(map, "A1"))?.name).toBe("Zombie");
  });

  it("targets a doorway guard before a werewolf in the current room", () => {
    const map = createTestMap();

    map.rooms[0][0].east = "guarded";
    map.rooms[0][1].west = "guarded";
    map.entities.monsters["A1:east:guard"] = {
      currentHealth: 2,
      damage: 1,
      id: "A1:east:guard",
      maximumHealth: 2,
      name: "Zombie",
      sprite: "z",
      type: "monster",
    };
    map.entities.monsters["B1:werewolf"] = {
      chases: true,
      currentHealth: 1,
      damage: 1,
      id: "B1:werewolf",
      maximumHealth: 1,
      name: "Werewolf",
      sprite: "w",
      type: "monster",
    };
    map.entities.doorwayGuards["A1:east:guard"] = {
      direction: "east",
      monsterId: "A1:east:guard",
      roomId: "A1",
    };
    map.rooms[0][0].contents = [{ id: "B1:werewolf", type: "monster" }];

    expect(
      getTargetableMonsters(map, getRoom(map, "A1")).map(
        (monster) => monster.name,
      ),
    ).toEqual(["Zombie", "Werewolf"]);
    expect(getRoomMonster(map, getRoom(map, "A1"))?.name).toBe("Zombie");
  });

  it("damages another available enemy before damaging the werewolf", () => {
    const map = createTestMap();

    map.entities.monsters["A1:monster"] = {
      currentHealth: 2,
      damage: 1,
      id: "A1:monster",
      maximumHealth: 2,
      name: "Zombie",
      sprite: "z",
      type: "monster",
    };
    map.entities.monsters["B1:werewolf"] = {
      chases: true,
      currentHealth: 1,
      damage: 1,
      id: "B1:werewolf",
      maximumHealth: 1,
      name: "Werewolf",
      sprite: "w",
      type: "monster",
    };
    map.rooms[0][0].contents = [
      { id: "B1:werewolf", type: "monster" },
      { id: "A1:monster", type: "monster" },
    ];

    const target = getRoomMonster(map, getRoom(map, "A1"));
    const nextMap = damageMonsterInRoom(map, "A1", target?.id ?? "", 1);

    expect(nextMap.entities.monsters["A1:monster"].currentHealth).toBe(1);
    expect(nextMap.entities.monsters["B1:werewolf"].currentHealth).toBe(1);
  });

  it("uses one room-content priority function to put the werewolf after other enemies", () => {
    const map = createTestMap();

    map.entities.monsters["A1:monster"] = {
      currentHealth: 2,
      damage: 1,
      id: "A1:monster",
      maximumHealth: 2,
      name: "Zombie",
      sprite: "z",
      type: "monster",
    };
    map.entities.monsters["B1:werewolf"] = {
      chases: true,
      currentHealth: 1,
      damage: 1,
      id: "B1:werewolf",
      maximumHealth: 1,
      name: "Werewolf",
      sprite: "w",
      type: "monster",
    };

    expect(
      prioritizeRoomContentsForTargeting(map, [
        { id: "B1:werewolf", type: "monster" },
        { id: "A1:monster", type: "monster" },
      ]),
    ).toEqual([
      { id: "A1:monster", type: "monster" },
      { id: "B1:werewolf", type: "monster" },
    ]);
  });

  it("moves the aggroed werewolf after a non-move action in an empty room", () => {
    const map = createTestMap();

    map.entities.monsters["B1:werewolf"] = {
      chases: true,
      currentHealth: 1,
      damage: 1,
      id: "B1:werewolf",
      maximumHealth: 1,
      name: "Werewolf",
      sprite: "w",
      type: "monster",
    };
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

    map.entities.monsters["B1:werewolf"] = {
      chases: true,
      currentHealth: 1,
      damage: 1,
      id: "B1:werewolf",
      maximumHealth: 1,
      name: "Werewolf",
      sprite: "w",
      type: "monster",
    };
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
