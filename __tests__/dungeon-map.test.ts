import {
    createSeededDungeonMap,
    damageMonsterInRoom,
    getConnectedRoomId,
    getRoomPosition,
    getRoom,
    getRoomItem,
    getRoomMonster,
    getRooms,
    getStairsRoom,
    hasRoomStairs,
    mapColumns,
    mapRows,
    type Direction,
} from "@/utils/dungeon-map";

const directionOffsets: Record<Direction, { letter: number; number: number }> = {
  east: { letter: 0, number: 1 },
  north: { letter: -1, number: 0 },
  south: { letter: 1, number: 0 },
  west: { letter: 0, number: -1 },
};

function getExpectedRoomId(roomId: string, direction: Direction) {
  const [, letter, number] = /^([A-Z])(\d+)$/.exec(roomId)!;
  const offset = directionOffsets[direction];
  const nextLetter = String.fromCharCode(letter.charCodeAt(0) + offset.letter);
  const nextNumber = Number(number) + offset.number;

  return `${nextLetter}${nextNumber}`;
}

function getEncounterableGuard(map: ReturnType<typeof createSeededDungeonMap>) {
  const guard = Object.values(map.entities.doorwayGuards).find((candidate) => {
    const monster = map.entities.monsters[candidate.monsterId];
    const sourceRoom = getRoom(map, candidate.roomId);
    const neighborRoom = getRoom(
      map,
      getExpectedRoomId(candidate.roomId, candidate.direction),
    );

    return (
      monster &&
      getRoomMonster(map, sourceRoom)?.id === monster.id &&
      getRoomMonster(map, neighborRoom)?.id === monster.id
    );
  });

  if (!guard) {
    throw new Error("Expected at least one encounterable doorway guard");
  }

  return guard;
}

describe("dungeon map generation", () => {
  it("uses six numbered columns and twelve lettered rows", () => {
    const map = createSeededDungeonMap("shape-check", 1);

    expect(map.rows).toEqual([1, 2, 3, 4, 5, 6]);
    expect(map.columns).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "G",
      "H",
      "I",
      "J",
      "K",
      "L",
    ]);
    expect(map.rows).toEqual(mapRows);
    expect(map.columns).toEqual(mapColumns);
    expect(map.rooms).toHaveLength(6);
    expect(map.rooms[0]).toHaveLength(12);
    expect(getRooms(map)).toHaveLength(72);
    expect(getRoom(map, "A1")).toEqual(expect.objectContaining({ column: "A", row: 1 }));
    expect(getRoom(map, "L6")).toEqual(expect.objectContaining({ column: "L", row: 6 }));
    expect(getRoom(map, "A7")).toBeUndefined();
    expect(getRoom(map, "M1")).toBeUndefined();
  });

  it("parses room ids with the new row and column bounds", () => {
    expect(getRoomPosition("A1")).toEqual({ column: "A", row: 1 });
    expect(getRoomPosition("L6")).toEqual({ column: "L", row: 6 });
    expect(getRoomPosition("A7")).toBeNull();
    expect(getRoomPosition("M1")).toBeNull();
    expect(getRoomPosition("not-a-room")).toBeNull();
  });

  it("creates identical maps and room contents for the same seed and level", () => {
    [1, 2, 3].forEach((level) => {
      const firstMap = createSeededDungeonMap("stable-seed", level);
      const secondMap = createSeededDungeonMap("stable-seed", level);

      expect(secondMap).toEqual(firstMap);
      expect(getRooms(secondMap).map((room) => room.contents)).toEqual(
        getRooms(firstMap).map((room) => room.contents),
      );
    });
  });

  it("keeps each floor deterministic while varying different seeds and levels", () => {
    const levelOne = createSeededDungeonMap("stable-seed", 1);
    const levelTwo = createSeededDungeonMap("stable-seed", 2);
    const differentSeed = createSeededDungeonMap("other-seed", 1);

    expect(levelTwo).toEqual(createSeededDungeonMap("stable-seed", 2));
    expect(levelTwo).not.toEqual(levelOne);
    expect(differentSeed).not.toEqual(levelOne);
  });

  it("keeps one empty starting room and one stairs room off the start", () => {
    const map = createSeededDungeonMap("stable-seed", 1);
    const startingRoom = getRoom(map, map.startingRoomId);
    const stairsRoom = getStairsRoom(map);

    expect(startingRoom?.contents).toEqual([]);
    expect(stairsRoom && hasRoomStairs(stairsRoom)).toBe(true);
    expect(stairsRoom?.id).not.toBe(map.startingRoomId);
    expect(startingRoom?.isCurrentPosition).toBe(true);
    expect(startingRoom?.isRevealed).toBe(true);
  });

  it("uses room ids as coordinates for directional movement", () => {
    const map = createSeededDungeonMap("coordinate-check", 1);

    getRooms(map).forEach((room) => {
      (["north", "east", "south", "west"] as Direction[]).forEach((direction) => {
        const connectedRoomId = getConnectedRoomId(map, room.id, direction);

        if (connectedRoomId) {
          expect(connectedRoomId).toBe(getExpectedRoomId(room.id, direction));
        }
      });
    });
  });

  it("creates one key for each locked door", () => {
    const map = createSeededDungeonMap("locked-floor", 1);
    const lockedDoorSides = getRooms(map).reduce(
      (count, room) =>
        count +
        (["north", "east", "south", "west"] as const).filter(
          (direction) => room[direction] === "locked",
        ).length,
      0,
    );
    const keyCount = getRooms(map).filter(
      (room) => getRoomItem(map, room)?.itemId === "key",
    ).length;

    expect(keyCount).toBe(lockedDoorSides / 2);
  });

  it("creates a silver bullet exactly when a werewolf exists", () => {
    [1, 2, 3, 4].forEach((level) => {
      const map = createSeededDungeonMap("werewolf-check", level);
      const silverBulletCount = getRooms(map).filter(
        (room) => getRoomItem(map, room)?.itemId === "silver-bullet",
      ).length;
      const werewolfCount = getRooms(map).filter(
        (room) => getRoomMonster(map, room)?.chases,
      ).length;

      expect(silverBulletCount).toBe(werewolfCount > 0 ? 1 : 0);
    });
  });

  it("creates doorway guards that can be encountered from either side", () => {
    const map = createSeededDungeonMap("monster-pool", 1);
    const guard = getEncounterableGuard(map);
    const monster = map.entities.monsters[guard.monsterId];
    const sourceRoom = getRoom(map, guard.roomId)!;
    const neighborRoom = getRoom(map, getExpectedRoomId(guard.roomId, guard.direction))!;

    expect(monster).toEqual(
      expect.objectContaining({
        currentHealth: expect.any(Number),
        damage: expect.any(Number),
        maximumHealth: expect.any(Number),
        sprite: expect.any(String),
        type: "monster",
      }),
    );
    expect(getRoomMonster(map, sourceRoom)).toEqual(monster);
    expect(getRoomMonster(map, neighborRoom)).toEqual(monster);
  });

  it("opens a guarded doorway after the guard is defeated", () => {
    const map = createSeededDungeonMap("monster-pool", 1);
    const guard = getEncounterableGuard(map);
    const defeatedMap = damageMonsterInRoom(
      map,
      guard.roomId,
      guard.monsterId,
      map.entities.monsters[guard.monsterId].currentHealth,
    );
    const sourceRoom = getRoom(defeatedMap, guard.roomId)!;
    const neighborRoom = getRoom(
      defeatedMap,
      getExpectedRoomId(guard.roomId, guard.direction),
    )!;

    expect(defeatedMap.entities.doorwayGuards[guard.monsterId]).toBeUndefined();
    expect(getRoomMonster(defeatedMap, sourceRoom)?.id).not.toBe(guard.monsterId);
    expect(getRoomMonster(defeatedMap, neighborRoom)?.id).not.toBe(guard.monsterId);
    expect(sourceRoom[guard.direction]).toBe("open");
    expect(neighborRoom[
      guard.direction === "north"
        ? "south"
        : guard.direction === "south"
          ? "north"
          : guard.direction === "east"
            ? "west"
            : "east"
    ]).toBe("open");
  });
});
