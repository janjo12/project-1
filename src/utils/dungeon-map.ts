//#region imports
import { GAME_PARAMETERS } from "@/gameparameters";
//#endregion

//#region types
export type Direction = "east" | "north" | "south" | "west";
export type ItemId = string;
export type RoomBoundary = "locked" | "guarded" | "open" | "wall";

export type WorldMonster = {
  currentHealth: number;
  damage: number;
  id: string;
  chases?: boolean;
  maximumHealth: number;
  name: string;
  sprite: string;
  type: "monster";
};

export type WorldItem = {
  id: ItemId;
  itemId?: ItemId;
  sprite?: string;
  label: string;
  type: "item";
};

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

export type RoomContents = (RoomMonsterRef | RoomItemRef | RoomStairsRef)[];

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
//#endregion

//#region constant declarations
// Legacy axis names: letters run vertically, numbers horizontally.
export const mapColumns = Array.from(
  { length: GAME_PARAMETERS.dungeon.mapHeightRooms },
  (_, index) => String.fromCharCode(65 + index),
);
export const mapRows = Array.from(
  { length: GAME_PARAMETERS.dungeon.mapWidthRooms }, (_, index) => index + 1,
);

export const POSSIBLE_MONSTERS: Omit<WorldMonster, "currentHealth" | "id">[] =
  GAME_PARAMETERS.monsters.map((monster) => ({ ...monster, type: "monster" as const }));

export const POSSIBLE_ITEMS: WorldItem[] = GAME_PARAMETERS.items.map((item) => ({
  ...item,
  type: "item" as const,
}));

export const directionDeltas: Record<Direction, { column: number; row: number }> = {
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
//#endregion

//#region small helper functions
export function getRoomId(position: GridPosition) {
  return `${position.column}${position.row}`;
}

export function getGridPosition(roomId: string): GridPosition | null {
  const match = /^([A-Z])(\d+)$/.exec(roomId);

  if (!match) {
    return null;
  }
  const position = {
    column: match[1],
    row: Number(match[2]),
  };

  if (!mapColumns.includes(position.column) || !mapRows.includes(position.row)) {
    return null;
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
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function createSeededRandom(seed: string) {
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

  if (!room) {
    return;
  }

  const neighbor = getNeighbor(room, direction);
  const neighborRoom = neighbor ? findRoomInGrid(rooms, getRoomId(neighbor)) : null;

  if (!neighborRoom) {
    return;
  }

  room[direction] = "open";
  neighborRoom[oppositeDirections[direction]] = "open";
}

export function setConnectionBoundary(
  rooms: DungeonMapJson,
  roomId: string,
  direction: Direction,
  boundary: RoomBoundary,
) {
  const room = findRoomInGrid(rooms, roomId);
  const neighbor = room ? getNeighbor(room, direction) : null;
  const neighborRoom = neighbor ? findRoomInGrid(rooms, getRoomId(neighbor)) : null;

  if (!room || !neighborRoom) {
    return;
  }

  room[direction] = boundary;
  neighborRoom[oppositeDirections[direction]] = boundary;
}

export function getReachableRoomIds(
  rooms: DungeonMapJson,
  startingRoomId: string,
  blockedConnection?: { direction: Direction; roomId: string },
) {
  const reachableRoomIds = new Set<string>();
  const queue = [startingRoomId];

  reachableRoomIds.add(startingRoomId);

  while (queue.length > 0) {
    const roomId = queue.shift()!;
    const room = findRoomInGrid(rooms, roomId);

    if (!room) {
      continue;
    }

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

  if (room?.[direction] !== "open") {
    return null;
  }

  const neighbor = getNeighbor(room, direction);

  if (!neighbor) {
    return null;
  }

  return findRoomInGrid(rooms, getRoomId(neighbor))?.id ?? null;
}

export function createMonster(index: number, roomId: string, random: () => number) {
  const monsters = POSSIBLE_MONSTERS.filter((monster) => !monster.chases);
  const monster = monsters[index % monsters.length];

  return {
    ...monster,
    currentHealth: monster.maximumHealth,
    id: `${roomId}:monster:${index}:${Math.floor(random() * 1_000_000)}`,
  } satisfies WorldMonster;
}

export function createWerewolf(roomId: string) {
  const werewolf = POSSIBLE_MONSTERS.find((monster) => monster.chases)!;

  return {
    ...werewolf,
    currentHealth: werewolf.maximumHealth,
    id: `${roomId}:werewolf`,
  } satisfies WorldMonster;
}

export function getNeighborRoom(rooms: DungeonMapJson, roomId: string, direction: Direction) {
  const room = findRoomInGrid(rooms, roomId);
  const neighbor = room ? getNeighbor(room, direction) : null;

  return neighbor ? findRoomInGrid(rooms, getRoomId(neighbor)) : null;
}

export function getDoorwayGuardPlacements(
  map: DungeonMap,
  roomId: string,
  direction: Direction,
) {
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

export function createItem(itemId: ItemId, id: string) {
  const baseItem = POSSIBLE_ITEMS.find((item) => item.id === itemId)!;

  return {
    ...baseItem,
    id,
    itemId,
  } satisfies WorldItem;
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
  const candidates = candidateRoomIds
    .map((roomId) => findRoomInGrid(map.rooms, roomId))
    .filter((room): room is DungeonRoom =>
      Boolean(
        room &&
          !room.isCurrentPosition &&
          !room.contents.some((content) => content.type === "stairs" || content.type === "item"),
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
