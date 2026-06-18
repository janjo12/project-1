import {
  createSeededDungeonMap,
  getConnectedRoomId,
  getRoom,
  getRoomMonster,
  getRooms,
  getStairsRoom,
  hasRoomStairs,
  POSSIBLE_MONSTERS,
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

describe("dungeon map generation", () => {
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
    const keyCount = getRooms(map).filter((room) =>
      room.contents.some(
        (content) => content.type === "item" && content.id === "key",
      ),
    ).length;

    expect(keyCount).toBe(lockedDoorSides / 2);
  });

  it("creates a silver bullet exactly when a werewolf exists", () => {
    [1, 2, 3, 4].forEach((level) => {
      const map = createSeededDungeonMap("werewolf-check", level);
      const silverBulletCount = getRooms(map).filter((room) =>
        room.contents.some(
          (content) => content.type === "item" && content.id === "silver-bullet",
        ),
      ).length;
      const werewolfCount = getRooms(map).filter(
        (room) => getRoomMonster(room)?.chases,
      ).length;

      expect(silverBulletCount).toBe(werewolfCount > 0 ? 1 : 0);
    });
  });

  it("populates rooms from possible monster objects", () => {
    const map = createSeededDungeonMap("monster-pool", 1);
    const monsterNames = new Set(POSSIBLE_MONSTERS.map((monster) => monster.name));
    const monster = getRooms(map).map(getRoomMonster).find(Boolean);

    expect(monster).toEqual(
      expect.objectContaining({
        currentHealth: expect.any(Number),
        damage: expect.any(Number),
        maximumHealth: expect.any(Number),
        sprite: expect.any(String),
        type: "monster",
      }),
    );
    expect(monsterNames.has(monster!.name)).toBe(true);
  });
});
