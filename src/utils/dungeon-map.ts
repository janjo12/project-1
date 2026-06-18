import AsyncStorage from "@react-native-async-storage/async-storage";

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
  sprite?: string;
  label: string;
  type: "item";
};

export type WorldStairs = {
  id: "stairs";
  label: string;
  type: "stairs";
};

export type RoomContents = (WorldMonster | WorldItem | WorldStairs)[];

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
  level: number;
  rooms: DungeonMapJson;
  rows: number[];
  startingRoomId: string;
};

export const mapColumns = [
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
];
export const mapRows = Array.from({ length: 6 }, (_, index) => index + 1);

export const POSSIBLE_MONSTERS: Omit<WorldMonster, "currentHealth" | "id">[] = [
  {
    damage: 1,
    maximumHealth: 3,
    name: "Glitch Imp",
    sprite: "\uD83D\uDC7E",
    type: "monster",
  },
  {
    damage: 1,
    maximumHealth: 3,
    name: "Crypt Stumbler",
    sprite: "\uD83E\uDDDF",
    type: "monster",
  },
  {
    damage: 1,
    maximumHealth: 3,
    name: "Tiny Dragon",
    sprite: "\uD83D\uDC09",
    type: "monster",
  },
  {
    damage: 1,
    maximumHealth: 3,
    name: "Night Count",
    sprite: "\uD83E\uDDDB",
    type: "monster",
  },
  {
    damage: 1,
    chases: true,
    maximumHealth: 1,
    name: "Werewolf",
    sprite: "\uD83D\uDC3A",
    type: "monster",
  },
];

export const POSSIBLE_ITEMS: WorldItem[] = [
  { id: "energy-meal", sprite: "🍔", label: "Energy Meal", type: "item" },
  { id: "health-potion", sprite: "🧪", label: "Health Potion", type: "item" },
  { id: "key", sprite: "🗝️", label: "Key", type: "item" },
  { id: "silver-bullet", sprite: "🔫",label: "Silver Bullet", type: "item" },
];

const MAP_STORAGE_KEY = "project-1:dungeon-map";

const directionDeltas: Record<Direction, { column: number; row: number }> = {
  east: { column: 0, row: 1 },
  north: { column: -1, row: 0 },
  south: { column: 1, row: 0 },
  west: { column: 0, row: -1 },
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

export function getGridPosition(roomId: string): GridPosition | null {
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

function createMonster(index: number, roomId: string, random: () => number) {
  const monsters = POSSIBLE_MONSTERS.filter((monster) => !monster.chases);
  const monster = monsters[index % monsters.length];

  return {
    ...monster,
    currentHealth: monster.maximumHealth,
    id: `${roomId}:monster:${index}:${Math.floor(random() * 1_000_000)}`,
  } satisfies WorldMonster;
}

function createWerewolf(roomId: string) {
  const werewolf = POSSIBLE_MONSTERS.find((monster) => monster.chases)!;

  return {
    ...werewolf,
    currentHealth: werewolf.maximumHealth,
    id: `${roomId}:werewolf`,
  } satisfies WorldMonster;
}

function createItem(itemId: ItemId) {
  return { ...POSSIBLE_ITEMS.find((item) => item.id === itemId)! };
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
      Boolean(
        room &&
          room.contents.some(
            (content) => content.type === "monster" && !content.chases,
          ),
      ),
    );
  const room = candidates[Math.floor(random() * candidates.length)];

  if (room) {
    room.contents = room.contents.filter((content) => content.type !== "monster");
    room.contents.push(createItem(itemId));
    return true;
  }

  return false;
}

export function createDungeonMap(
  level: number,
  random: () => number,
  startingPosition?: GridPosition,
): DungeonMap {
  const rooms = createEmptyGrid();
  const finalStartingPosition = startingPosition ?? {
    column: mapColumns[Math.floor(random() * mapColumns.length)],
    row: mapRows[Math.floor(random() * mapRows.length)],
  };
  const startingRoomId = getRoomId(finalStartingPosition);
  const allRoomIds = new Set([startingRoomId]);
  const totalRooms = Math.min(72, 7 + level + Math.floor(random() * 5)); //7 + level + 0-4, to a max of 72 (the whole map)

  while (allRoomIds.size < totalRooms) {
    const shuffledRooms = shuffle([...allRoomIds], random);
    let addedRoom = false;

    for (const roomId of shuffledRooms) {
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

        if (!neighborId || allRoomIds.has(neighborId)) {
          continue;
        }

        openConnection(rooms, roomId, direction);
        allRoomIds.add(neighborId);
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

  [...allRoomIds].forEach((roomId) => {
    const room = findRoomInGrid(rooms, roomId);

    if (!room) {
      return;
    }

    const directions = shuffle(Object.keys(directionDeltas) as Direction[], random);

    directions.slice(0, 2).forEach((direction) => {
      const neighbor = getNeighbor(room, direction);
      const neighborId = neighbor ? getRoomId(neighbor) : null;

      if (!neighborId || !allRoomIds.has(neighborId) || random() > 0.25) {
        return;
      }

      openConnection(rooms, roomId, direction);
    });
  });

  const stairsCandidates = [...allRoomIds].filter(
    (roomId) => roomId !== startingRoomId,
  );
  const stairsRoomId =
    stairsCandidates[Math.floor(random() * stairsCandidates.length)] ??
    startingRoomId;

  [...allRoomIds].forEach((roomId) => {
    const room = findRoomInGrid(rooms, roomId);

    if (!room) {
      return;
    }

    if (roomId === startingRoomId) {
      room.isCurrentPosition = true;
      room.isRevealed = true;
      return;
    }

    if (roomId === stairsRoomId) {
      room.contents = [{ id: "stairs", label: "Stairs", type: "stairs" }];
      return;
    }

    room.contents = [createMonster(Math.floor(random() * 4), roomId, random)];
  });

  const lockableConnections = [...allRoomIds].flatMap((roomId) => {
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
      findRoomInGrid(rooms, roomId)?.contents.some(
        (content) => content.type === "monster",
      ),
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

  const werewolfCandidateRooms = [...allRoomIds].filter((roomId) => {
    const room = findRoomInGrid(rooms, roomId);

    return Boolean(
      room &&
        room.id !== startingRoomId &&
        !room.contents.some((content) => content.type === "stairs") &&
        getReachableRoomIds(rooms, startingRoomId).has(room.id),
    );
  });
  const werewolfRoomId =
    werewolfCandidateRooms.length > 0 && random() < 0.85
      ? werewolfCandidateRooms[
          Math.floor(random() * werewolfCandidateRooms.length)
        ]
      : null;
  const reachableRoomIds = [...getReachableRoomIds(rooms, startingRoomId)];

  if (werewolfRoomId) {
    const werewolfRoom = findRoomInGrid(rooms, werewolfRoomId);
    const silverBulletRoomIds = reachableRoomIds.filter(
      (roomId) => roomId !== werewolfRoomId,
    );

    if (werewolfRoom && placeItem(rooms, silverBulletRoomIds, "silver-bullet", random)) {
      werewolfRoom.contents = [
        ...werewolfRoom.contents.filter((content) => content.type !== "monster"),
        createWerewolf(werewolfRoomId),
      ];
    }
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
  };
}

export function createSeededDungeonMap(
  seed: string,
  level: number,
  startingPosition?: GridPosition,
) {
  const random = createSeededRandom(`${seed}:level:${level}`);

  return createDungeonMap(level, random, startingPosition);
}

export async function saveDungeonMap(map: DungeonMap) {
  await AsyncStorage.setItem(MAP_STORAGE_KEY, JSON.stringify(map));
}

export async function loadDungeonMap() {
  const storedMap = await AsyncStorage.getItem(MAP_STORAGE_KEY);

  return storedMap ? (JSON.parse(storedMap) as DungeonMap) : null;
}

export async function createAndSaveSeededDungeonMap(
  seed: string,
  level: number,
  startingPosition?: GridPosition,
) {
  const map = createSeededDungeonMap(seed, level, startingPosition);

  await saveDungeonMap(map);

  return map;
}

export async function updateStoredDungeonMap(
  updater: (map: DungeonMap) => DungeonMap,
) {
  const map = await loadDungeonMap();

  if (!map) {
    return null;
  }

  const nextMap = updater(map);

  await saveDungeonMap(nextMap);

  return nextMap;
}

export function getRooms(map: DungeonMap) {
  return map.rooms.flat();
}

export function getRoom(map: DungeonMap, roomId: string) {
  return getRooms(map).find((room) => room.id === roomId);
}

export function getCurrentRoom(map: DungeonMap) {
  return getRooms(map).find((room) => room.isCurrentPosition);
}

export function getCurrentRoomId(map: DungeonMap) {
  return getCurrentRoom(map)?.id ?? map.startingRoomId;
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

export function getRoomMonster(room: DungeonRoom | undefined) {
  return room?.contents.find(
    (content): content is WorldMonster =>
      content.type === "monster" && content.currentHealth > 0,
  ) ?? null;
}

export function getRoomItem(room: DungeonRoom | undefined) {
  return room?.contents.find(
    (content): content is WorldItem => content.type === "item",
  ) ?? null;
}

export function getRoomItemId(room: DungeonRoom | undefined) {
  return getRoomItem(room)?.id ?? null;
}

export function hasRoomStairs(room: DungeonRoom | undefined) {
  return Boolean(room?.contents.some((content) => content.type === "stairs"));
}

export function getStairsRoom(map: DungeonMap) {
  return getRooms(map).find((room) => hasRoomStairs(room));
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

        if (neighbor && room.id === getRoomId(neighbor)) {
          return { ...room, [oppositeDirections[direction]]: "open" };
        }

        return room;
      }),
    ),
  };
}

export function moveCurrentPosition(map: DungeonMap, nextRoomId: string) {
  return {
    ...map,
    rooms: map.rooms.map((row) =>
      row.map((room) => ({
        ...room,
        isCurrentPosition: room.id === nextRoomId,
        isRevealed:
          room.isRevealed || room.isCurrentPosition || room.id === nextRoomId,
      })),
    ),
  };
}

export function damageMonsterInRoom(
  map: DungeonMap,
  roomId: string,
  monsterId: string,
  damage: number,
) {
  return {
    ...map,
    rooms: map.rooms.map((row) =>
      row.map((room) =>
        room.id === roomId
          ? {
              ...room,
              contents: room.contents.map((content) =>
                content.type === "monster" && content.id === monsterId
                  ? {
                      ...content,
                      currentHealth: Math.max(0, content.currentHealth - damage),
                    }
                  : content,
              ),
            }
          : room,
      ),
    ),
  };
}

export function removeItemFromRoom(map: DungeonMap, roomId: string, itemId: ItemId) {
  return {
    ...map,
    rooms: map.rooms.map((row) =>
      row.map((room) =>
        room.id === roomId
          ? {
              ...room,
              contents: room.contents.filter(
                (content) => !(content.type === "item" && content.id === itemId),
              ),
            }
          : room,
      ),
    ),
  };
}

export function addItemToRoom(map: DungeonMap, roomId: string, itemId: ItemId) {
  return {
    ...map,
    rooms: map.rooms.map((row) =>
      row.map((room) =>
        room.id === roomId
          ? { ...room, contents: [...room.contents, createItem(itemId)] }
          : room,
      ),
    ),
  };
}

export function getActiveRooms(map: DungeonMap) {
  return getRooms(map).filter(
    (room) =>
      room.isRevealed ||
      room.contents.length > 0 ||
      getOpenDirections(map, room.id).length > 0,
  );
}

export function getRoomPosition(roomId: string) {
  return getGridPosition(roomId);
}
