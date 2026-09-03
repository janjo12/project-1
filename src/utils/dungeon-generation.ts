import { GAME_PARAMETERS } from "@/gameparameters";
import {
  createEmptyGrid,
  createItem,
  createMonster,
  createSeededRandom,
  createWerewolf,
  directionDeltas,
  findRoomInGrid,
  getConnectedRoomIdFromRooms,
  getDoorwayGuardPlacement,
  getNeighbor,
  getReachableRoomIds,
  getRoomId,
  mapColumns,
  mapRows,
  openConnection,
  placeDoorwayGuard,
  placeItem,
  setConnectionBoundary,
  shuffle,
  type Direction,
  type DoorwayGuard,
  type DungeonGenerationContext,
  type DungeonMap,
  type GridPosition,
  type RoomConnection,
  type RoomMonsterRef,
  type RoomStairsRef,
  type WorldItem,
  type WorldMonster,
} from "@/utils/dungeon-map";
export function createSeededDungeonMap(seed: string, level: number, startingPosition?: GridPosition, includeClock = false) {
  const map = createDungeonMap(
    level,
    createSeededRandom(`${seed}:level:${level}`),
    startingPosition,
    includeClock,
  );

  return seed === "test" && level === 1 ? createTestDungeon(map) : map;
}

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

function createTestDungeon(map: DungeonMap) {
  const guardIds = new Set(Object.keys(map.entities.doorwayGuards));

  map.rooms.flat().forEach((room) => {
    (Object.keys(directionDeltas) as Direction[]).forEach((direction) => {
      if (room[direction] === "guarded" || room[direction] === "locked") {
        setConnectionBoundary(map.rooms, room.id, direction, "open");
      }
    });
    room.contents = room.contents.filter(
      (content) => content.type !== "item" &&
        !(content.type === "monster" && map.entities.monsters[content.id]?.chases),
    );
  });

  map.entities.items = {};
  map.entities.doorwayGuards = {};
  Object.keys(map.entities.monsters).forEach((monsterId) => {
    if (guardIds.has(monsterId) || map.entities.monsters[monsterId]?.chases) {
      delete map.entities.monsters[monsterId];
    }
  });

  const reachableRooms = [...getReachableRoomIds(map.rooms, map.startingRoomId)]
    .map((roomId) => findRoomInGrid(map.rooms, roomId))
    .filter((room): room is NonNullable<typeof room> =>
      Boolean(
        room &&
          room.id !== map.startingRoomId &&
          !room.contents.some((content) => content.type === "stairs"),
      ),
    )
    .sort((left, right) => left.id.localeCompare(right.id));
  const itemIds = GAME_PARAMETERS.items.map((item) => item.id);
  const itemRooms = reachableRooms.slice(0, itemIds.length);
  const werewolfRoom = reachableRooms[itemIds.length];

  itemIds.forEach((itemId, index) => {
    const room = itemRooms[index];
    if (!room) return;
    const item = createItem(itemId, `test:${itemId}:${room.id}`);
    map.entities.items[item.id] = item;
    room.contents.push({ id: item.id, type: "item" });
  });

  if (werewolfRoom) {
    const werewolf = createWerewolf(werewolfRoom.id);
    map.entities.monsters[werewolf.id] = werewolf;
    werewolfRoom.contents = [
      ...werewolfRoom.contents.filter((content) => content.type !== "monster"),
      { id: werewolf.id, type: "monster" },
    ];

    const lockedDirection = (Object.keys(directionDeltas) as Direction[]).find(
      (direction) => werewolfRoom[direction] === "open",
    );
    if (lockedDirection) {
      setConnectionBoundary(map.rooms, werewolfRoom.id, lockedDirection, "locked");
    }
  }

  return map;
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

      if (
        !neighborId ||
        !allRoomIds.has(neighborId) ||
        random() > GAME_PARAMETERS.dungeon.extraConnectionChance
      ) {
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
    Math.max(
      0,
      context.allRoomIds.size * GAME_PARAMETERS.dungeon.doorwayGuardsPerRoom,
    ),
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
  const lockedDoorCount =
    lockableConnections.length > 0 &&
    context.random() < GAME_PARAMETERS.dungeon.lockedDoorChance
      ? 1
      : 0;

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
    werewolfCandidateRooms.length > 0 &&
    context.random() < GAME_PARAMETERS.dungeon.werewolfChance
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
  includeClock: boolean,
) {
  if (context.random() < GAME_PARAMETERS.dungeon.optionalLootChance) {
    placeItem(
      createMapFromContext(context),
      reachableRoomIds,
      "health-potion",
      context.random,
    );
  }

  if (context.random() < GAME_PARAMETERS.dungeon.optionalLootChance) {
    placeItem(
      createMapFromContext(context),
      reachableRoomIds,
      "energy-meal",
      context.random,
    );
  }

  if (includeClock && context.random() < GAME_PARAMETERS.dungeon.optionalLootChance) {
    placeItem(createMapFromContext(context), reachableRoomIds, "clock", context.random);
  }
}
//#endregion

export function createDungeonMap(
  level: number,
  random: () => number,
  startingPosition?: GridPosition,
  includeClock = false,
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
  const totalRooms = Math.min(
    GAME_PARAMETERS.dungeon.maxRoomCount,
    GAME_PARAMETERS.dungeon.baseRoomCount +
      level +
      Math.floor(random() * GAME_PARAMETERS.dungeon.extraRoomCountRange),
  );

  growRoomNetwork(context, totalRooms);
  addExtraRoomConnections(context);
  placeDoorwayGuards(context);
  placeStairsAndStartingRoom(context);
  lockRandomDoors(context);

  const reachableRoomIds = [...getReachableRoomIds(rooms, startingRoomId)];

  placeWerewolfAndSilverBullet(context, reachableRoomIds);
  placeOptionalLoot(context, reachableRoomIds, includeClock);

  return createMapFromContext(context);
}
