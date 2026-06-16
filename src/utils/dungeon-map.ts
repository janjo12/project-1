export type Direction = "east" | "north" | "south" | "west";
export type ItemId = "energy-meal" | "health-potion" | "key" | "silver-bullet";
export type RoomBoundary = "locked" | "obstacle" | "open" | "wall";
export type RoomContents = `enemy-${number}` | `item-${ItemId}` | "empty" | "stairs";

export type GridPosition = {
  column: string;
  row: number;
};

export type DungeonRoom = GridPosition & {
  contents: RoomContents;
  east: RoomBoundary;
  id: string;
  north: RoomBoundary;
  south: RoomBoundary;
  west: RoomBoundary;
};

export type DungeonMapJson = DungeonRoom[][];

export type DungeonMap = {
  columns: string[];
  level: number;
  rooms: DungeonMapJson;
  rows: number[];
  startingRoomId: string;
  stairsRoomId: string;
  werewolfRoomId: string | null;
};

export const mapColumns = ["A", "B", "C", "D", "E", "F"];
export const mapRows = Array.from({ length: 12 }, (_, index) => index + 1);

const directionDeltas: Record<Direction, { column: number; row: number }> = {
  east: { column: 1, row: 0 },
  north: { column: 0, row: -1 },
  south: { column: 0, row: 1 },
  west: { column: -1, row: 0 },
};

const oppositeDirections: Record<Direction, Direction> = {
  east: "west",
  north: "south",
  south: "north",
  west: "east",
};

function getRoomId(position: GridPosition) {
  return `${position.column}${position.row}`;
}

function getGridPosition(roomId: string): GridPosition | null {
  const match = /^([A-Z])(\d+)$/.exec(roomId);

  if (!match) {
    return null;
  }

  return {
    column: match[1],
    row: Number(match[2]),
  };
}

function getNeighbor(position: GridPosition, direction: Direction) {
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

function shuffle<T>(items: T[], random: () => number) {
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

function createEmptyGrid(): DungeonMapJson {
  return mapRows.map((row) =>
    mapColumns.map((column) => ({
      column,
      contents: "empty",
      east: "wall",
      id: `${column}${row}`,
      north: "wall",
      row,
      south: "wall",
      west: "wall",
    })),
  );
}

function findRoomInGrid(rooms: DungeonMapJson, roomId: string) {
  return rooms.flat().find((room) => room.id === roomId);
}

function openConnection(rooms: DungeonMapJson, roomId: string, direction: Direction) {
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

function setConnectionBoundary(
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

function getReachableRoomIds(
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

function getConnectedRoomIdFromRooms(
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

function placeItem(
  rooms: DungeonMapJson,
  candidateRoomIds: string[],
  itemId: ItemId,
  random: () => number,
) {
  const candidates = candidateRoomIds
    .map((roomId) => findRoomInGrid(rooms, roomId))
    .filter((room): room is DungeonRoom =>
      Boolean(room && room.contents.startsWith("enemy-")),
    );
  const room = candidates[Math.floor(random() * candidates.length)];

  if (room) {
    room.contents = `item-${itemId}`;
    return true;
  }

  return false;
}

export function createDungeonMap(level: number, random: () => number): DungeonMap {
  const rooms = createEmptyGrid();
  const startingPosition = {
    column: mapColumns[Math.floor(random() * mapColumns.length)],
    row: mapRows[Math.floor(random() * mapRows.length)],
  };
  const startingRoomId = getRoomId(startingPosition);
  const activeRoomIds = new Set([startingRoomId]);
  const roomTarget = 10 + Math.floor(random() * 5);

  while (activeRoomIds.size < roomTarget) {
    const frontier = shuffle([...activeRoomIds], random);
    let addedRoom = false;

    for (const roomId of frontier) {
      const room = findRoomInGrid(rooms, roomId);

      if (!room) {
        continue;
      }

      const directions = shuffle(
        Object.keys(directionDeltas) as Direction[],
        random,
      );

      for (const direction of directions) {
        const neighbor = getNeighbor(room, direction);
        const neighborId = neighbor ? getRoomId(neighbor) : null;

        if (!neighborId || activeRoomIds.has(neighborId)) {
          continue;
        }

        openConnection(rooms, roomId, direction);
        activeRoomIds.add(neighborId);
        addedRoom = true;
        break;
      }

      if (addedRoom) {
        break;
      }
    }

    if (!addedRoom) {
      break;
    }
  }

  [...activeRoomIds].forEach((roomId) => {
    const room = findRoomInGrid(rooms, roomId);

    if (!room) {
      return;
    }

    const directions = shuffle(Object.keys(directionDeltas) as Direction[], random);

    directions.slice(0, 2).forEach((direction) => {
      const neighbor = getNeighbor(room, direction);
      const neighborId = neighbor ? getRoomId(neighbor) : null;

      if (!neighborId || !activeRoomIds.has(neighborId) || random() > 0.25) {
        return;
      }

      openConnection(rooms, roomId, direction);
    });
  });

  const stairsCandidates = [...activeRoomIds].filter(
    (roomId) => roomId !== startingRoomId,
  );
  const stairsRoomId =
    stairsCandidates[Math.floor(random() * stairsCandidates.length)] ??
    startingRoomId;

  [...activeRoomIds].forEach((roomId) => {
    const room = findRoomInGrid(rooms, roomId);

    if (!room) {
      return;
    }

    if (roomId === startingRoomId) {
      room.contents = "empty";
      return;
    }

    if (roomId === stairsRoomId) {
      room.contents = "stairs";
      return;
    }

    room.contents = `enemy-${Math.floor(random() * 4)}`;
  });

  const lockableConnections = [...activeRoomIds].flatMap((roomId) => {
    const room = findRoomInGrid(rooms, roomId);

    if (!room) {
      return [] as { direction: Direction; roomId: string }[];
    }

    return (Object.keys(directionDeltas) as Direction[])
      .filter((direction) => {
        const nextRoomId = getConnectedRoomIdFromRooms(rooms, roomId, direction);

        return (
          room[direction] === "open" &&
          nextRoomId !== null &&
          roomId.localeCompare(nextRoomId) < 0
        );
      })
      .map((direction) => ({ direction, roomId }));
  });
  const lockedDoorCount = lockableConnections.length > 0 && random() < 0.7 ? 1 : 0;

  for (let index = 0; index < lockedDoorCount; index += 1) {
    const connection =
      lockableConnections[Math.floor(random() * lockableConnections.length)];
    const reachableRoomIds = [
      ...getReachableRoomIds(rooms, startingRoomId, connection),
    ];
    const reachableEnemyCount = reachableRoomIds.filter((roomId) =>
      findRoomInGrid(rooms, roomId)?.contents.startsWith("enemy-"),
    ).length;

    if (reachableEnemyCount > 1 && placeItem(rooms, reachableRoomIds, "key", random)) {
      setConnectionBoundary(
        rooms,
        connection.roomId,
        connection.direction,
        "locked",
      );
    }
  }

  const werewolfCandidateRooms = [...activeRoomIds].filter((roomId) => {
    const room = findRoomInGrid(rooms, roomId);

    return Boolean(
      room &&
        room.id !== startingRoomId &&
        room.contents !== "stairs" &&
        getReachableRoomIds(rooms, startingRoomId).has(room.id),
    );
  });
  let werewolfRoomId =
    werewolfCandidateRooms.length > 0 && random() < 0.85
      ? werewolfCandidateRooms[
          Math.floor(random() * werewolfCandidateRooms.length)
        ]
      : null;
  const reachableRoomIds = [...getReachableRoomIds(rooms, startingRoomId)];

  if (werewolfRoomId && !placeItem(rooms, reachableRoomIds, "silver-bullet", random)) {
    werewolfRoomId = null;
  }

  if (random() < 0.35) {
    placeItem(rooms, reachableRoomIds, "health-potion", random);
  }

  if (random() < 0.35) {
    placeItem(rooms, reachableRoomIds, "energy-meal", random);
  }

  return {
    columns: mapColumns,
    level,
    rooms,
    rows: mapRows,
    startingRoomId,
    stairsRoomId,
    werewolfRoomId,
  };
}

export function createSeededDungeonMap(
  seed: string,
  level: number,
  enemyCount: number,
) {
  const random = createSeededRandom(`${seed}:level:${level}`);
  const map = createDungeonMap(level, random);
  const seededMap = {
    ...map,
    rooms: map.rooms.map((row) =>
      row.map((room) => ({
        ...room,
        contents: room.contents.startsWith("enemy-")
          ? (`enemy-${getRoomEnemyIndex(room)! % enemyCount}` as const)
          : room.contents,
      })),
    ),
  };

  console.log("Generated dungeon map", seededMap);

  return seededMap;
}

export function getRooms(map: DungeonMap) {
  return map.rooms.flat();
}

export function getRoom(map: DungeonMap, roomId: string) {
  return getRooms(map).find((room) => room.id === roomId);
}

export function getConnectedRoomId(
  map: DungeonMap,
  roomId: string,
  direction: Direction,
) {
  const room = getRoom(map, roomId);

  if (room?.[direction] !== "open") {
    return null;
  }

  const neighbor = getNeighbor(room, direction);

  if (!neighbor) {
    return null;
  }

  return getRoom(map, getRoomId(neighbor))?.id ?? null;
}

export function getOpenDirections(map: DungeonMap, roomId: string) {
  const directions: Direction[] = ["north", "east", "south", "west"];

  return directions.filter(
    (direction) => getConnectedRoomId(map, roomId, direction) !== null,
  );
}

export function getLockedDirections(map: DungeonMap, roomId: string) {
  const room = getRoom(map, roomId);
  const directions: Direction[] = ["north", "east", "south", "west"];

  if (!room) {
    return [];
  }

  return directions.filter((direction) => room[direction] === "locked");
}

export function unlockDoor(
  map: DungeonMap,
  roomId: string,
  direction: Direction,
): DungeonMap {
  return {
    ...map,
    rooms: map.rooms.map((row) =>
      row.map((room) => {
        if (room.id === roomId) {
          return { ...room, [direction]: "open" };
        }

        const sourceRoom = getRoom(map, roomId);
        const neighbor = sourceRoom ? getNeighbor(sourceRoom, direction) : null;

        if (
          neighbor &&
          room.id === getRoomId(neighbor)
        ) {
          return { ...room, [oppositeDirections[direction]]: "open" };
        }

        return room;
      }),
    ),
  };
}

export function getActiveRooms(map: DungeonMap) {
  return getRooms(map).filter(
    (room) =>
      room.id === map.startingRoomId ||
      room.contents !== "empty" ||
      getOpenDirections(map, room.id).length > 0,
  );
}

export function getRoomItemId(room: DungeonRoom | undefined) {
  if (!room?.contents.startsWith("item-")) {
    return null;
  }

  return room.contents.replace("item-", "") as ItemId;
}

export function getRoomEnemyIndex(room: DungeonRoom | undefined) {
  if (!room?.contents.startsWith("enemy-")) {
    return null;
  }

  return Number(room.contents.replace("enemy-", ""));
}

export function getRoomPosition(roomId: string) {
  return getGridPosition(roomId);
}
