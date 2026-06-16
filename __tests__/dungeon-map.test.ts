import {
  createSeededDungeonMap,
  getRoom,
  getRooms,
} from "@/utils/dungeon-map";

describe("dungeon map generation", () => {
  it("creates identical maps and room contents for the same seed and level", () => {
    [1, 2, 3].forEach((level) => {
      const firstMap = createSeededDungeonMap("stable-seed", level, 4);
      const secondMap = createSeededDungeonMap("stable-seed", level, 4);

      expect(secondMap).toEqual(firstMap);
      expect(getRooms(secondMap).map((room) => room.contents)).toEqual(
        getRooms(firstMap).map((room) => room.contents),
      );
    });
  });

  it("keeps each floor deterministic while varying different seeds and levels", () => {
    const levelOne = createSeededDungeonMap("stable-seed", 1, 4);
    const levelTwo = createSeededDungeonMap("stable-seed", 2, 4);
    const differentSeed = createSeededDungeonMap("other-seed", 1, 4);

    expect(levelTwo).toEqual(createSeededDungeonMap("stable-seed", 2, 4));
    expect(levelTwo).not.toEqual(levelOne);
    expect(differentSeed).not.toEqual(levelOne);
  });

  it("keeps one empty starting room and one stairs room off the start", () => {
    const map = createSeededDungeonMap("stable-seed", 1, 4);
    const startingRoom = getRoom(map, map.startingRoomId);
    const stairsRoom = getRoom(map, map.stairsRoomId);

    expect(startingRoom?.contents).toBe("empty");
    expect(stairsRoom?.contents).toBe("stairs");
    expect(map.stairsRoomId).not.toBe(map.startingRoomId);
  });

  it("creates one key for each locked door", () => {
    const map = createSeededDungeonMap("locked-floor", 1, 4);
    const lockedDoorSides = getRooms(map).reduce(
      (count, room) =>
        count +
        (["north", "east", "south", "west"] as const).filter(
          (direction) => room[direction] === "locked",
        ).length,
      0,
    );
    const keyCount = getRooms(map).filter(
      (room) => room.contents === "item-key",
    ).length;

    expect(keyCount).toBe(lockedDoorSides / 2);
  });

  it("creates a silver bullet exactly when a werewolf exists", () => {
    [1, 2, 3, 4].forEach((level) => {
      const map = createSeededDungeonMap("werewolf-check", level, 4);
      const silverBulletCount = getRooms(map).filter(
        (room) => room.contents === "item-silver-bullet",
      ).length;

      expect(silverBulletCount).toBe(map.werewolfRoomId ? 1 : 0);
    });
  });
});
