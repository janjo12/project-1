//#region imports
import AsyncStorage from "@react-native-async-storage/async-storage";
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

type DungeonGenerationContext = {
  allRoomIds: Set<string>;
  entities: DungeonMap["entities"];
  level: number;
  random: () => number;
  rooms: DungeonMapJson;
  startingRoomId: string;
};

type RoomConnection = {
  direction: Direction;
  roomId: string;
};
//#endregion

//#region constant declarations
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
    maximumHealth: 1,
    name: "Pixel Golem",
    sprite: "\uD83D\uDC7E",
    type: "monster",
  },
  {
    damage: 1,
    maximumHealth: 4,
    name: "Zombie",
    sprite: "\uD83E\uDDDF",
    type: "monster",
  },
  {
    damage: 2,
    maximumHealth: 2,
    name: "Dragon",
    sprite: "\uD83D\uDC09",
    type: "monster",
  },
  {
    damage: 1,
    maximumHealth: 3,
    name: "Vampire",
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
//#endregion

//#region small helper functions
function getRoomId(position: GridPosition) {
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

function getNeighborRoom(rooms: DungeonMapJson, roomId: string, direction: Direction) {
  const room = findRoomInGrid(rooms, roomId);
  const neighbor = room ? getNeighbor(room, direction) : null;

  return neighbor ? findRoomInGrid(rooms, getRoomId(neighbor)) : null;
}

export function getDoorwayGuardPlacement(
  map: DungeonMap,
  roomId: string,
  direction: Direction,
) {
  return Object.values(map.entities.doorwayGuards).find((guard) =>
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

function createItem(itemId: ItemId, id: string) {
  const baseItem = POSSIBLE_ITEMS.find((item) => item.id === itemId)!;

  return {
    ...baseItem,
    id,
    itemId,
  } satisfies WorldItem;
}

function placeDoorwayGuard(
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

function placeItem(
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
          !room.contents.some((content) => content.type === "stairs"),
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

export function getGuardedDirections(map: DungeonMap, roomId: string) {
  const room = getRoom(map, roomId);
  const directions: Direction[] = ["north", "east", "south", "west"];

  if (!room) {
    return [];
  }

  return directions.filter((direction) => room[direction] === "guarded");
}

function prioritizeRoomContentsForTargeting(map: DungeonMap, contents: RoomContents) {
  return [...contents].sort((left, right) => {
    const leftMonster =
      left.type === "monster" ? map.entities.monsters[left.id] : null;
    const rightMonster =
      right.type === "monster" ? map.entities.monsters[right.id] : null;

    return (
      Number(Boolean(leftMonster?.chases)) -
      Number(Boolean(rightMonster?.chases))
    );
  });
}

export function getTargetableRoomMonsterRefs(
  map: DungeonMap,
  room: DungeonRoom | undefined,
) {
  return prioritizeRoomContentsForTargeting(map, room?.contents ?? []).filter(
    (content): content is RoomMonsterRef => {
      const monster =
        content.type === "monster" ? map.entities.monsters[content.id] : null;

      return Boolean(monster && monster.currentHealth > 0);
    },
  );
}

function getLivingMonster(map: DungeonMap, monsterId: string) {
  const monster = map.entities.monsters[monsterId] ?? null;

  return monster && monster.currentHealth > 0 ? monster : null;
}

export function getTargetableMonsters(
  map: DungeonMap,
  room: DungeonRoom | undefined,
) {
  if (!room) {
    return [];
  }

  const monsters = [
    ...getTargetableRoomMonsterRefs(map, room)
      .map((monsterRef) => getLivingMonster(map, monsterRef.id))
      .filter((monster): monster is WorldMonster => Boolean(monster)),
    ...(Object.keys(directionDeltas) as Direction[])
      .map((direction) => getDoorwayGuardPlacement(map, room.id, direction))
      .map((guard) => (guard ? getLivingMonster(map, guard.monsterId) : null))
      .filter((monster): monster is WorldMonster => Boolean(monster)),
  ];
  const uniqueMonsters = [
    ...new Map(monsters.map((monster) => [monster.id, monster])).values(),
  ];

  return uniqueMonsters.sort(
    (leftMonster, rightMonster) =>
      Number(Boolean(leftMonster.chases)) - Number(Boolean(rightMonster.chases)),
  );
}

export function getRoomMonster(map: DungeonMap, room: DungeonRoom | undefined) {
  return getTargetableMonsters(map, room)[0] ?? null;
}

export function getWerewolf(map: DungeonMap) {
  return (
    Object.values(map.entities.monsters).find(
      (monster) => monster.chases && monster.currentHealth > 0,
    ) ?? null
  );
}

function getItemFromRoom(map: DungeonMap, room: DungeonRoom | undefined) {
  const itemId = room?.contents.find((content) => content.type === "item")?.id;

  return itemId ? map.entities.items[itemId] ?? null : null;
}

export function getRoomItem(map: DungeonMap, room: DungeonRoom | undefined) {
  return getItemFromRoom(map, room);
}

export function getRoomItemId(map: DungeonMap, room: DungeonRoom | undefined) {
  return getRoomItem(map, room)?.itemId ?? null;
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
  const nextMonster = map.entities.monsters[monsterId];

  if (!nextMonster) {
    return map;
  }

  const nextHealth = Math.max(0, nextMonster.currentHealth - damage);
  const nextMap: DungeonMap = {
    ...map,
    entities: {
      ...map.entities,
      monsters: {
        ...map.entities.monsters,
        [monsterId]: {
          ...nextMonster,
          currentHealth: nextHealth,
        },
      },
    },
  };

  const doorwayGuard = nextMap.entities.doorwayGuards[monsterId];

  if (!doorwayGuard || nextHealth > 0) {
    return nextMap;
  }

  const sourceRoom = getRoom(nextMap, doorwayGuard.roomId);
  const neighbor = sourceRoom ? getNeighbor(sourceRoom, doorwayGuard.direction) : null;

  const nextRooms = nextMap.rooms.map((row) =>
    row.map((room) => {
      if (room.id === doorwayGuard.roomId) {
        return { ...room, [doorwayGuard.direction]: "open" };
      }

      if (neighbor && room.id === getRoomId(neighbor)) {
        return { ...room, [oppositeDirections[doorwayGuard.direction]]: "open" };
      }

      return room;
    }),
  );

  const { [monsterId]: _removedGuard, ...remainingDoorwayGuards } = nextMap.entities.doorwayGuards;

  return {
    ...nextMap,
    entities: {
      ...nextMap.entities,
      doorwayGuards: remainingDoorwayGuards,
    },
    rooms: nextRooms,
  };
}

export function removeItemFromRoom(map: DungeonMap, roomId: string, itemId: ItemId) {
  return {
    ...map,
    entities: {
      ...map.entities,
      items: Object.fromEntries(
        Object.entries(map.entities.items).filter(([, item]) => item.id !== itemId),
      ),
    },
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
  const nextItem = createItem(
    itemId,
    `${itemId}:${roomId}:${Date.now()}:${Math.floor(Math.random() * 1_000_000)}`,
  );

  return {
    ...map,
    entities: {
      ...map.entities,
      items: {
        ...map.entities.items,
        [nextItem.id]: nextItem,
      },
    },
    rooms: map.rooms.map((row) =>
      row.map((room) =>
        room.id === roomId
          ? {
              ...room,
              contents: [
                ...room.contents,
                { id: nextItem.id, type: "item" } satisfies RoomItemRef,
              ],
            }
          : room,
      ),
    ),
  };
}

export function moveWerewolfToRoom(map: DungeonMap, roomId: string) {
  const werewolf = getWerewolf(map);

  if (!werewolf) {
    return map;
  }

  return {
    ...map,
    rooms: map.rooms.map((row) =>
      row.map((room) => {
        const contentsWithoutWerewolf = room.contents.filter(
          (content) =>
            content.type !== "monster" ||
            !map.entities.monsters[content.id]?.chases,
        );

        if (room.id !== roomId) {
          return {
            ...room,
            contents: contentsWithoutWerewolf,
          };
        }

        return {
          ...room,
          contents: prioritizeRoomContentsForTargeting(map, [
            ...contentsWithoutWerewolf,
            { id: werewolf.id, type: "monster" } satisfies RoomMonsterRef,
          ]),
        };
      }),
    ),
  };
}

export function getActiveRooms(map: DungeonMap) {
  return getRooms(map).filter(
    (room) =>
      room.isRevealed ||
      room.contents.length > 0 ||
      getOpenDirections(map, room.id).length > 0 ||
      getGuardedDirections(map, room.id).length > 0,
  );
}

export function getRoomPosition(roomId: string) {
  return getGridPosition(roomId);
}
//#endregion

//#region large helper functions
function createMapFromContext({
  entities,
  level,
  rooms,
  startingRoomId,
}: DungeonGenerationContext): DungeonMap {
  return {
    columns: mapColumns,
    entities,
    level,
    rooms,
    rows: mapRows,
    startingRoomId,
  };
}

function growRoomNetwork({
  allRoomIds,
  random,
  rooms,
}: DungeonGenerationContext, totalRooms: number) {
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
}

function addExtraRoomConnections({
  allRoomIds,
  random,
  rooms,
}: DungeonGenerationContext) {
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
}

function getUniqueOpenConnections({
  allRoomIds,
  rooms,
}: DungeonGenerationContext) {
  return [...allRoomIds].flatMap((roomId) => {
    const room = findRoomInGrid(rooms, roomId);

    if (!room) {
      return [] as RoomConnection[];
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
}

function placeDoorwayGuards(context: DungeonGenerationContext) {
  const doorwayConnections = getUniqueOpenConnections(context);
  const doorwayGuardCount = Math.min(
    doorwayConnections.length,
    Math.max(0, context.allRoomIds.size / 2),
  );

  shuffle(doorwayConnections, context.random)
    .slice(0, doorwayGuardCount)
    .forEach((connection, index) => {
      const monster = createMonster(
        index,
        `${connection.roomId}:${connection.direction}`,
        context.random,
      );

      placeDoorwayGuard(
        createMapFromContext(context),
        connection.roomId,
        connection.direction,
        monster,
      );
    });
}

function placeStairsAndStartingRoom(context: DungeonGenerationContext) {
  const stairsCandidates = [...context.allRoomIds].filter(
    (roomId) => roomId !== context.startingRoomId,
  );
  const stairsRoomId =
    stairsCandidates[Math.floor(context.random() * stairsCandidates.length)] ??
    context.startingRoomId;

  [...context.allRoomIds].forEach((roomId) => {
    const room = findRoomInGrid(context.rooms, roomId);

    if (!room) {
      return;
    }

    if (roomId === context.startingRoomId) {
      room.isCurrentPosition = true;
      room.isRevealed = true;
      return;
    }

    if (roomId === stairsRoomId) {
      room.contents = [
        { id: "stairs", label: "Stairs", type: "stairs" } satisfies RoomStairsRef,
      ];
    }
  });
}

function lockRandomDoors(context: DungeonGenerationContext) {
  const lockableConnections = getUniqueOpenConnections(context);
  const lockedDoorCount = lockableConnections.length > 0 && context.random() < 0.7 ? 1 : 0;

  for (let index = 0; index < lockedDoorCount; index += 1) {
    const connection =
      lockableConnections[Math.floor(context.random() * lockableConnections.length)];
    const reachableRoomIds = [
      ...getReachableRoomIds(context.rooms, context.startingRoomId, connection),
    ];

    if (
      placeItem(
        createMapFromContext(context),
        reachableRoomIds,
        "key",
        context.random,
      )
    ) {
      setConnectionBoundary(
        context.rooms,
        connection.roomId,
        connection.direction,
        "locked",
      );
    }
  }
}

function getWerewolfCandidateRooms(context: DungeonGenerationContext) {
  return [...context.allRoomIds].filter((roomId) => {
    const room = findRoomInGrid(context.rooms, roomId);
    const guardedDirections = (Object.keys(directionDeltas) as Direction[]).filter(
      (direction) =>
        Boolean(getDoorwayGuardPlacement(createMapFromContext(context), roomId, direction)),
    );

    return Boolean(
      room &&
        room.id !== context.startingRoomId &&
        !room.contents.some((content) => content.type === "stairs") &&
        guardedDirections.length === 0 &&
        getReachableRoomIds(context.rooms, context.startingRoomId).has(room.id),
    );
  });
}

function placeWerewolfAndSilverBullet(
  context: DungeonGenerationContext,
  reachableRoomIds: string[],
) {
  const werewolfCandidateRooms = getWerewolfCandidateRooms(context);
  const werewolfRoomId =
    werewolfCandidateRooms.length > 0 && context.random() < 0.45
      ? werewolfCandidateRooms[
          Math.floor(context.random() * werewolfCandidateRooms.length)
        ]
      : null;

  if (!werewolfRoomId) {
    return;
  }

  const werewolfRoom = findRoomInGrid(context.rooms, werewolfRoomId);
  const silverBulletRoomIds = reachableRoomIds.filter(
    (roomId) => roomId !== werewolfRoomId,
  );

  if (
    werewolfRoom &&
    placeItem(
      createMapFromContext(context),
      silverBulletRoomIds,
      "silver-bullet",
      context.random,
    )
  ) {
    const werewolf = createWerewolf(werewolfRoomId);

    context.entities.monsters[werewolf.id] = werewolf;
    werewolfRoom.contents = [
      ...werewolfRoom.contents.filter((content) => content.type !== "monster"),
      { id: werewolf.id, type: "monster" } satisfies RoomMonsterRef,
    ];
  }
}

function placeOptionalLoot(
  context: DungeonGenerationContext,
  reachableRoomIds: string[],
) {
  if (context.random() < 0.45) {
    placeItem(
      createMapFromContext(context),
      reachableRoomIds,
      "health-potion",
      context.random,
    );
  }

  if (context.random() < 0.45) {
    placeItem(
      createMapFromContext(context),
      reachableRoomIds,
      "energy-meal",
      context.random,
    );
  }
}
//#endregion

export function createDungeonMap(
  level: number,
  random: () => number,
  startingPosition?: GridPosition,
): DungeonMap {
  const rooms = createEmptyGrid();
  const entities = {
    items: {} as Record<string, WorldItem>,
    doorwayGuards: {} as Record<string, DoorwayGuard>,
    monsters: {} as Record<string, WorldMonster>,
  };
  const finalStartingPosition = startingPosition ?? {
    column: mapColumns[Math.floor(random() * mapColumns.length)],
    row: mapRows[Math.floor(random() * mapRows.length)],
  };
  const startingRoomId = getRoomId(finalStartingPosition);
  const allRoomIds = new Set([startingRoomId]);
  const context: DungeonGenerationContext = {
    allRoomIds,
    entities,
    level,
    random,
    rooms,
    startingRoomId,
  };
  const totalRooms = Math.min(72, 7 + level + Math.floor(random() * 5));

  growRoomNetwork(context, totalRooms);
  addExtraRoomConnections(context);
  placeDoorwayGuards(context);
  placeStairsAndStartingRoom(context);
  lockRandomDoors(context);

  const reachableRoomIds = [...getReachableRoomIds(rooms, startingRoomId)];

  placeWerewolfAndSilverBullet(context, reachableRoomIds);
  placeOptionalLoot(context, reachableRoomIds);

  return createMapFromContext(context);
}
