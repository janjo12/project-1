import { resolveRoomMovement } from "@/game/engine/movement";
import type { DungeonMap, DungeonRoom, Direction } from "@/game/dungeon/types";

function makeMap(boundary: "open" | "locked" | "guarded" | "wall"): DungeonMap {
  const room = (id: string, row: number, east: DungeonRoom["east"], west: DungeonRoom["west"]): DungeonRoom => ({
    column: "A", contents: [], east, id, isCurrentPosition: id === "A1", isRevealed: id === "A1",
    north: "wall", row, south: "wall", west,
  });
  return {
    columns: ["A"], rows: [1, 2], level: 1, startingRoomId: "A1",
    rooms: [[room("A1", 1, boundary, "wall"), room("A2", 2, "wall", boundary)]],
    entities: { doorwayGuards: {}, equipment: {}, items: {}, monsters: {} },
  };
}

describe("documented movement rules", () => {
  it.each([
    ["open", false, false, "A2"],
    ["locked", true, false, "A2"],
    ["locked", false, true, "A1"],
    ["guarded", true, true, null],
    ["wall", true, true, null],
    ["locked", false, false, null],
  ] as [DungeonRoom["east"], boolean, boolean, string | null][])(
    "resolves %s edge with key=%s thief=%s to %s",
    (edge, canUseKey, isThief, expected) => {
      expect(resolveRoomMovement({ map: makeMap(edge), roomId: "A1", direction: "east" as Direction, canUseKey, isThief, revealAdjacent: false })?.roomId ?? null).toBe(expected);
    },
  );

  it("returns a revealed immutable map snapshot when movement succeeds", () => {
    const map = makeMap("open");
    const result = resolveRoomMovement({ map, roomId: "A1", direction: "east", canUseKey: false, isThief: false, revealAdjacent: false });
    expect(result?.map).not.toBe(map);
    expect(result?.map.rooms[0][1].isCurrentPosition).toBe(true);
    expect(map.rooms[0][0].isCurrentPosition).toBe(true);
  });

  it("lets a Thief open a lock in place unless the action is charged", () => {
    const map = makeMap("locked");
    const opened = resolveRoomMovement({ map, roomId: "A1", direction: "east", canUseKey: false, isThief: true, revealAdjacent: false });
    expect(opened?.roomId).toBe("A1");
    expect(opened?.usedKey).toBe(false);
    expect(opened?.map.rooms[0][0].east).toBe("open");
    expect(opened?.map.rooms[0][0].isCurrentPosition).toBe(true);
    const chargedMove = resolveRoomMovement({ map, roomId: "A1", direction: "east", canUseKey: false, isThief: true, isCharged: true, revealAdjacent: false });
    expect(chargedMove?.roomId).toBe("A2");
  });

  it("spends a key only when an ordinary class opens a locked door", () => {
    const result = resolveRoomMovement({ map: makeMap("locked"), roomId: "A1", direction: "east", canUseKey: true, isThief: false, revealAdjacent: false });
    expect(result?.usedKey).toBe(true);
    expect(result?.map.rooms[0][1].west).toBe("open");
  });
});
