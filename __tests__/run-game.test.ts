import {
  getHardTurnLimit,
  getTurnDuration,
  runGameLoop,
  TURN_DURATION,
} from "@/hooks/run-game";
import type { DungeonMap, DungeonRoom } from "@/utils/dungeon-map";

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
});
