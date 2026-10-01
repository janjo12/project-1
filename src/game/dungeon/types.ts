import { GAME_PARAMETERS } from "@/game/config/gameparameters";
import {
  type WorldMonster,
} from "@/game/entities/enemies";
import {
  createItem,
  type ItemId,
  type WorldEquipment,
  type WorldItem,
} from "@/game/entities/items";
export { createMonster, createWerewolf, POSSIBLE_MONSTERS } from "@/game/entities/enemies";
export type { WorldMonster } from "@/game/entities/enemies";
export { createEquipment, createItem, POSSIBLE_EQUIPMENT, POSSIBLE_ITEMS } from "@/game/entities/items";
export type { EquipmentCatalogEntry, EquipmentId, ItemId, WorldEquipment, WorldItem } from "@/game/entities/items";
export type Direction = "east" | "north" | "south" | "west";
export type RoomBoundary = "locked" | "guarded" | "open" | "wall";

export type WorldStairs = {
  id: "stairs";
  label: string;
  type: "stairs";
};

export type RoomMonsterRef = {
  id: string;
  type: "monster";
};

export type RoomItemRef = {
  id: string;
  type: "item";
};

export type RoomStairsRef = {
  id: "stairs";
  label?: string;
  type: "stairs";
};

export type DoorwayGuard = {
  direction: Direction;
  monsterId: string;
  roomId: string;
};

export type RoomEquipmentRef = { id: string; type: "equipment" };
export type RoomContents = (RoomMonsterRef | RoomItemRef | RoomEquipmentRef | RoomStairsRef)[];

export type GridPosition = {
  column: string;
  row: number;
};

export type DungeonRoom = GridPosition & {
  contents: RoomContents;
  east: RoomBoundary;
  id: string;
  isCurrentPosition: boolean;
  isRevealed: boolean;
  north: RoomBoundary;
  south: RoomBoundary;
  west: RoomBoundary;
};

export type DungeonMapJson = DungeonRoom[][];

export type DungeonMap = {
  columns: string[];
  entities: {
    items: Record<string, WorldItem>;
  equipment: Record<string, WorldEquipment>;
    doorwayGuards: Record<string, DoorwayGuard>;
    monsters: Record<string, WorldMonster>;
  };
  level: number;
  rooms: DungeonMapJson;
  rows: number[];
  startingRoomId: string;
};

export type DungeonGenerationContext = {
  allRoomIds: Set<string>;
  entities: DungeonMap["entities"];
  level: number;
  random: () => number;
  rooms: DungeonMapJson;
  startingRoomId: string;
};

export type RoomConnection = {
  direction: Direction;
  roomId: string;
};
// Legacy axis names: letters run vertically, numbers horizontally.
export const mapColumns = Array.from(
  { length: GAME_PARAMETERS.dungeon.mapHeightRooms },
  (_, index) => String.fromCharCode(65 + index),
);
export const mapRows = Array.from(
  { length: GAME_PARAMETERS.dungeon.mapWidthRooms }, (_, index) => index + 1,
);

export const directionDeltas: Record<Direction, { column: number; row: number }> = {
  // Grid columns encode letters and rows encode numbers; these deltas define compass movement.
  east: { column: 0, row: 1 },
  north: { column: -1, row: 0 },
  south: { column: 1, row: 0 },
  west: { column: 0, row: -1 },
};

export const oppositeDirections: Record<Direction, Direction> = {
  east: "west",
  north: "south",
  south: "north",
  west: "east",
};
export function getRoomId(position: GridPosition) {
  return `${position.column}${position.row}`;
}

export function getGridPosition(roomId: string): GridPosition {
  const match = /^([A-Z])(\d+)$/.exec(roomId);

  if (!match) {
    throw new Error(`Invalid room ID: ${roomId}`);
  }
  const position = {
    column: match[1],
    row: Number(match[2]),
  };

  if (!mapColumns.includes(position.column) || !mapRows.includes(position.row)) {
    throw new Error(`Room ID is outside the dungeon grid: ${roomId}`);
  }

  return position;
}

export function getNeighbor(position: GridPosition, direction: Direction) {
  const columnIndex = mapColumns.indexOf(position.column);
  const delta = directionDeltas[direction];
  const nextColumn = mapColumns[columnIndex + delta.column];
  const nextRow = position.row + delta.row;

  if (!nextColumn || nextRow < mapRows[0] || nextRow > mapRows[mapRows.length - 1]) {
    return null;
  }

  return {
    column: nextColumn,
    row: nextRow,
  };
}

export function shuffle<T>(items: T[], random: () => number) {
  // Fisher–Yates uses the injected RNG so seeded maps stay reproducible.
  const shuffledItems = [...items];

  for (let index = shuffledItems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffledItems[index], shuffledItems[swapIndex]] = [
      shuffledItems[swapIndex],
      shuffledItems[index],
    ];
  }

  return shuffledItems;
}

export function hashSeed(seed: string) {
  // Convert arbitrary text into a stable 32-bit starting state for the dungeon random stream.
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function createSeededRandom(seed: string) {
  // This compact generator is deterministic; changing its constants changes every generated map.
  let state = hashSeed(seed) || 1;

  return () => {
    state = Math.imul(state, 1664525) + 1013904223;
    return (state >>> 0) / 4294967296;
  };
}

export function createEmptyGrid(): DungeonMapJson {
  return mapRows.map((row) =>
    mapColumns.map((column) => ({
      column,
      contents: [],
      east: "wall",
      id: `${column}${row}`,
      isCurrentPosition: false,
      isRevealed: false,
      north: "wall",
      row,
      south: "wall",
      west: "wall",
    })),
  );
}

export function findRoomInGrid(rooms: DungeonMapJson, roomId: string) {
  return rooms.flat().find((room) => room.id === roomId);
}

export function openConnection(rooms: DungeonMapJson, roomId: string, direction: Direction) {
  const room = findRoomInGrid(rooms, roomId);

  if (!room) throw new Error(`Cannot open connection from missing room ${roomId}`);

  const neighbor = getNeighbor(room, direction);
  const neighborRoom = neighbor ? findRoomInGrid(rooms, getRoomId(neighbor)) : null;

  if (!neighborRoom) throw new Error(`Cannot open ${direction} connection from edge room ${roomId}`);

  room[direction] = "open";
  neighborRoom[oppositeDirections[direction]] = "open";
}

export function setConnectionBoundary(
  rooms: DungeonMapJson,
  roomId: string,
  direction: Direction,
  boundary: RoomBoundary,
) {
  // Store a doorway boundary on both adjacent rooms to keep the map symmetric.
  const room = findRoomInGrid(rooms, roomId);
  if (!room) throw new Error(`Cannot set connection boundary from missing room ${roomId}`);
  const neighbor = getNeighbor(room, direction);
  const neighborRoom = neighbor ? findRoomInGrid(rooms, getRoomId(neighbor)) : null;

  if (!neighborRoom) throw new Error(`Cannot set ${direction} boundary from edge room ${roomId}`);

  room[direction] = boundary;
  neighborRoom[oppositeDirections[direction]] = boundary;
}

export function getReachableRoomIds(
  rooms: DungeonMapJson,
  startingRoomId: string,
  blockedConnection?: { direction: Direction; roomId: string },
) {
  // Breadth-first traversal follows only open passages and can treat one candidate connection as blocked.
  const reachableRoomIds = new Set<string>();
  const queue = [startingRoomId];

  reachableRoomIds.add(startingRoomId);

  while (queue.length > 0) {
    const roomId = queue.shift()!;
    const room = findRoomInGrid(rooms, roomId);

    if (!room) throw new Error(`Reachability traversal references missing room ${roomId}`);

    (Object.keys(directionDeltas) as Direction[]).forEach((direction) => {
      if (room[direction] !== "open") {
        return;
      }

      const nextRoomId = getConnectedRoomIdFromRooms(rooms, roomId, direction);

      if (!nextRoomId) {
        return;
      }

      if (
        blockedConnection &&
        ((blockedConnection.roomId === roomId &&
          blockedConnection.direction === direction) ||
          (blockedConnection.roomId === nextRoomId &&
            oppositeDirections[blockedConnection.direction] === direction))
      ) {
        return;
      }

      if (reachableRoomIds.has(nextRoomId)) {
        return;
      }

      reachableRoomIds.add(nextRoomId);
      queue.push(nextRoomId);
    });
  }

  return reachableRoomIds;
}

export function getConnectedRoomIdFromRooms(
  rooms: DungeonMapJson,
  roomId: string,
  direction: Direction,
) {
  const room = findRoomInGrid(rooms, roomId);

  if (!room) throw new Error(`Room ${roomId} is missing from dungeon grid`);
  if (room[direction] !== "open") {
    return null;
  }

  const neighbor = getNeighbor(room, direction);

  if (!neighbor) {
    throw new Error(`Open ${direction} doorway from edge room ${roomId} has no neighbor`);
  }

  const neighborRoom = findRoomInGrid(rooms, getRoomId(neighbor));
  if (!neighborRoom) throw new Error(`Open ${direction} doorway from ${roomId} leads to missing room ${getRoomId(neighbor)}`);
  return neighborRoom.id;
}

export function getNeighborRoom(rooms: DungeonMapJson, roomId: string, direction: Direction) {
  const room = findRoomInGrid(rooms, roomId);
  if (!room) throw new Error(`Room ${roomId} is missing from dungeon grid`);
  const neighbor = getNeighbor(room, direction);

  if (!neighbor) return null;
  const neighborRoom = findRoomInGrid(rooms, getRoomId(neighbor));
  if (!neighborRoom) throw new Error(`Neighbor room ${getRoomId(neighbor)} is missing from dungeon grid`);
  return neighborRoom;
}

export function getDoorwayGuardPlacements(
  map: DungeonMap,
  roomId: string,
  direction: Direction,
) {
  // A guard may be registered from either side of a doorway, so query both orientations.
  return Object.values(map.entities.doorwayGuards).filter((guard) =>
    (guard.roomId === roomId && guard.direction === direction) ||
    (() => {
      const neighborRoom = getNeighborRoom(map.rooms, roomId, direction);

      return Boolean(
        neighborRoom &&
          guard.roomId === neighborRoom.id &&
          guard.direction === oppositeDirections[direction],
      );
    })(),
  );
}

// Compatibility helper for callers that only need to know whether a door is guarded.
export function getDoorwayGuardPlacement(map: DungeonMap, roomId: string, direction: Direction) {
  return getDoorwayGuardPlacements(map, roomId, direction)[0];
}

export function placeDoorwayGuard(
  map: DungeonMap,
  roomId: string,
  direction: Direction,
  monster: WorldMonster,
) {
  map.entities.monsters[monster.id] = monster;
  map.entities.doorwayGuards[monster.id] = {
    direction,
    monsterId: monster.id,
    roomId,
  };
  setConnectionBoundary(map.rooms, roomId, direction, "guarded");
}

export function placeItem(
  map: DungeonMap,
  candidateRoomIds: string[],
  itemId: ItemId,
  random: () => number,
) {
  // Choose only an empty, non-start, non-exit room; false means the requested placement had no valid slot.
  const candidates = candidateRoomIds
    .map((roomId) => findRoomInGrid(map.rooms, roomId))
    .filter((room): room is DungeonRoom =>
      Boolean(
        room &&
          !room.isCurrentPosition &&
          !room.contents.some((content) => content.type === "stairs" || content.type === "item" || content.type === "equipment"),
      ),
    );
  const room = candidates[Math.floor(random() * candidates.length)];

  if (room) {
    const nextItem = createItem(
      itemId,
      `${itemId}:${room.id}:${Math.floor(random() * 1_000_000)}`,
    );

    map.entities.items[nextItem.id] = nextItem;
    room.contents.push({ id: nextItem.id, type: "item" } satisfies RoomItemRef);
    return true;
  }

  return false;
}
