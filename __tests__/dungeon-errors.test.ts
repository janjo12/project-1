import { resolveRoomMovement } from "@/game/engine/movement";
import { getEquipmentStats, getItemLabel } from "@/game/actions/items";
import { getGridPosition, type DungeonMap, type DungeonRoom } from "@/game/dungeon/types";
import {
  getCurrentRoom,
  getRoom,
  getRoomItem,
  getRoomMonster,
  moveCurrentPosition,
} from "@/game/dungeon/rooms";

function room(id: string, column: string, row: number, current = false): DungeonRoom {
  return {
    column,
    contents: [],
    east: "wall",
    id,
    isCurrentPosition: current,
    isRevealed: current,
    north: "wall",
    row,
    south: "wall",
    west: "wall",
  };
}

function mapWithRoom(current = true): DungeonMap {
  const start = room("A1", "A", 1, current);
  const next = room("A2", "A", 2);
  start.east = "open";
  next.west = "open";
  return {
    columns: ["A"],
    entities: { doorwayGuards: {}, equipment: {}, items: {}, monsters: {} },
    level: 1,
    rooms: [[start, next]],
    rows: [1, 2],
    startingRoomId: "A1",
  };
}

describe("dungeon invalid-state errors", () => {
  it("rejects malformed and out-of-grid room IDs", () => {
    expect(() => getGridPosition("not-a-room")).toThrow("Invalid room ID");
    expect(() => getGridPosition("Z99")).toThrow("outside the dungeon grid");
  });

  it("throws for unknown catalog IDs instead of returning neutral or raw labels", () => {
    expect(() => getEquipmentStats("missing-equipment")).toThrow("Unknown equipment");
    expect(() => getItemLabel("missing-item" as never)).toThrow("Unknown inventory item");
  });

  it("throws when a requested room is absent", () => {
    expect(() => getRoom(mapWithRoom(), "B7")).toThrow("Room B7 is missing");
  });

  it("throws when a map has no current room instead of falling back to its start", () => {
    expect(() => getCurrentRoom(mapWithRoom(false))).toThrow("no current room");
    expect(() => moveCurrentPosition(mapWithRoom(false), "A2")).toThrow("no current room");
  });

  it("keeps blocked movement as an expected no-result", () => {
    const map = mapWithRoom();
    expect(resolveRoomMovement({
      canUseKey: false,
      direction: "north",
      isThief: false,
      map,
      revealAdjacent: false,
      roomId: "A1",
    })).toBeNull();
  });

  it("throws when room contents point to a missing entity", () => {
    const map = mapWithRoom();
    map.rooms[0][0].contents = [{ id: "missing-item", type: "item" }];
    expect(() => getRoomItem(map, map.rooms[0][0])).toThrow("references missing item");

    map.rooms[0][0].contents = [{ id: "missing-monster", type: "monster" }];
    expect(() => getRoomMonster(map, map.rooms[0][0])).toThrow("missing monster");
  });
});
