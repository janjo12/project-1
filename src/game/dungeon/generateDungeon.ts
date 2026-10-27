import { GAME_PARAMETERS } from "@/game/config/gameparameters";
import { createMonster, createWerewolf } from "@/game/entities/enemies";
import { createEquipment, createItem } from "@/game/entities/items";
import {
  createEmptyGrid,
  createSeededRandom,
  directionDeltas,
  findRoomInGrid,
  getGridPosition,
  getConnectedRoomIdFromRooms,
  getDoorwayGuardPlacement,
  getReachableRoomIds,
  getNeighborInGrid,
  getRoomId,
  mapColumns,
  mapRows,
  openConnection,
  oppositeDirections,
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
  type WorldEquipment,
  type WorldMonster,
} from "@/game/dungeon/types";
export function createSeededDungeonMap(seed: string, level: number, startingPosition?: GridPosition, includeClock = false, playerCount = 1) {
  // Deriving the stream from seed + level keeps each floor reproducible and independent of prior RNG calls.
  const normalizedSeed = seed.trim().toLowerCase();
  const testDungeonSeeds = ["test", "testwarrior", "testcleric", "testthief"];
  const generationSeed = level === 1 && testDungeonSeeds.includes(normalizedSeed) ? "test" : seed;
  const testStartingPosition = level === 1 && testDungeonSeeds.includes(normalizedSeed)
    ? { column: "B", row: 5 }
    : startingPosition;
  const map = createDungeonMap(
    level,
    createSeededRandom(`${generationSeed}:level:${level}`),
    testStartingPosition,
    includeClock,
    playerCount,
    level === 1 && testDungeonSeeds.includes(normalizedSeed),
  );

  const testDungeonSeed = testDungeonSeeds.find((candidate) => candidate === normalizedSeed);
  return testDungeonSeed && level === 1
    ? createTestDungeon(map, testDungeonSeed, playerCount)
    : map;
}

function getLevelGridBounds(level: number) {
  const maximumGridCapacity = mapColumns.length * mapRows.length;
  let gridHeight = 1;
  let gridWidth = 1;

  // Keep each axis nondecreasing so a stair-entry position always fits on the next floor.
  for (let floor = 1; floor <= Math.min(level, GAME_PARAMETERS.dungeon.maxRoomCount); floor += 1) {
    const maxRooms = Math.min(
      GAME_PARAMETERS.dungeon.maxRoomCount,
      GAME_PARAMETERS.dungeon.baseRoomCount + floor + GAME_PARAMETERS.dungeon.extraRoomCountRange - 1,
    );
    const headroom = Math.ceil((maximumGridCapacity - maxRooms) * 0.1);
    const targetCapacity = Math.min(maximumGridCapacity, maxRooms + headroom);
    const nextHeight = Math.max(1, Math.min(mapColumns.length, Math.round(Math.sqrt(targetCapacity / 2))));
    const nextWidth = Math.min(mapRows.length, Math.ceil(targetCapacity / nextHeight));
    gridHeight = Math.max(gridHeight, nextHeight);
    gridWidth = Math.max(gridWidth, nextWidth);
  }

  return { columns: mapColumns.slice(0, gridHeight), rows: mapRows.slice(0, gridWidth) };
}

function createMapFromContext({
  entities,
  columns,
  level,
  rooms,
  rows,
  startingRoomId,
}: DungeonGenerationContext): DungeonMap {
  return {
    columns,
    entities,
    level,
    rooms,
    rows,
    startingRoomId,
  };
}

function createTestDungeon(map: DungeonMap, seed: string, playerCount: number) {
  // The test seed is a real single-path floor so UI tests can follow ordinary doorways without
  // coordinate injection, hidden state mutation, or probabilistic route planning.
  const catalogItemIds = GAME_PARAMETERS.items.map(({ id }) => id);
  const itemIds = ["key", ...catalogItemIds.filter((id) => id !== "key")];
  const route = findTestDungeonRoute(map.rooms, map.startingRoomId, itemIds.length + 6);
  if (route.length !== itemIds.length + 6) throw new Error("Test dungeon route does not fit the room grid");

  map.entities = { items: {}, equipment: {}, doorwayGuards: {}, monsters: {} };
  map.rooms.flat().forEach((room) => {
    room.contents = [];
    room.isCurrentPosition = room.id === map.startingRoomId;
    room.isRevealed = room.id === map.startingRoomId;
    room.north = room.east = room.south = room.west = "wall";
  });

  route.forEach((roomId, index) => {
    const room = findRoomInGrid(map.rooms, roomId)!;
    let incomingDirection: Direction | undefined;
    if (index > 0) {
      const previous = findRoomInGrid(map.rooms, route[index - 1])!;
      const delta = { column: room.column.charCodeAt(0) - previous.column.charCodeAt(0), row: room.row - previous.row };
      incomingDirection = (Object.keys(directionDeltas) as Direction[]).find((candidate) => {
        const step = directionDeltas[candidate];
        return step.column === delta.column && step.row === delta.row;
      });
      if (!incomingDirection) throw new Error(`Test route has a non-adjacent step: ${previous.id} to ${room.id}`);
      setConnectionBoundary(map.rooms, previous.id, incomingDirection, index === 2 ? "locked" : "open");

      if ((index > itemIds.length && index <= itemIds.length + 3) || index === itemIds.length + 5) {
        const monster = createMonster((index - itemIds.length - 1) * 4, `${previous.id}:${incomingDirection}`, () => 0, map.level, playerCount);
        placeDoorwayGuard(map, previous.id, incomingDirection, monster);
      }
    }
    if (index > 0 && index <= itemIds.length) {
      const item = createItem(itemIds[index - 1], `test:${itemIds[index - 1]}:${room.id}`);
      map.entities.items[item.id] = item;
      room.contents.push({ id: item.id, type: "item" });
    } else if (index === itemIds.length + 4) {
      const werewolf = createWerewolf(room.id, map.level, playerCount);
      map.entities.monsters[werewolf.id] = werewolf;
      room.contents.push({ id: werewolf.id, type: "monster" });
    } else if (index === itemIds.length + 5) {
      room.contents.push({ id: "stairs", label: "Stairs", type: "stairs" });
    }
  });

  // Keep reserved test floors consistent with ordinary floors: the entrance always has two exits.
  ensureTestStartingRoomHasSecondDoorway(map, route);

  return map;
}

function ensureTestStartingRoomHasSecondDoorway(map: DungeonMap, route: string[]) {
  const startingRoom = findRoomInGrid(map.rooms, map.startingRoomId)!;
  const openDoorways = (Object.keys(directionDeltas) as Direction[])
    .filter(direction => startingRoom[direction] !== "wall").length;
  if (openDoorways >= 2) return;

  for (const direction of Object.keys(directionDeltas) as Direction[]) {
    if (startingRoom[direction] !== "wall") continue;
    const neighbor = getNeighborInGrid(map.rooms, startingRoom, direction);
    if (!neighbor) continue;
    const neighborId = getRoomId(neighbor);
    if (route.includes(neighborId)) continue;
    openConnection(map.rooms, startingRoom.id, direction);
    return;
  }

  throw new Error(`Test dungeon starting room ${startingRoom.id} cannot have a second doorway`);
}

function findTestDungeonRoute(rooms: DungeonMap["rooms"], startingRoomId: string, length: number) {
  const route = [startingRoomId];
  const visited = new Set(route);
  const walk = (): boolean => {
    if (route.length >= length) return true;
    const current = getGridPosition(route[route.length - 1]);
    for (const direction of Object.keys(directionDeltas) as Direction[]) {
      const neighbor = getNeighborInGrid(rooms, current, direction);
      if (!neighbor) continue;
      const nextId = getRoomId(neighbor);
      if (visited.has(nextId)) continue;
      visited.add(nextId);
      route.push(nextId);
      if (walk()) return true;
      route.pop();
      visited.delete(nextId);
    }
    return false;
  };
  walk();
  return route;
}

function growRoomNetwork({
  allRoomIds,
  random,
  rooms,
}: DungeonGenerationContext, totalRooms: number) {
  // Add one adjacent room at a time; this guarantees the generated room set remains connected.
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
        const neighbor = getNeighborInGrid(rooms, room, direction);
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
  // Optional loops create alternate routes; changing the chance affects map branching, not room count.
  [...allRoomIds].forEach((roomId) => {
    const room = findRoomInGrid(rooms, roomId);

    if (!room) {
      return;
    }

    const directions = shuffle(Object.keys(directionDeltas) as Direction[], random);

    directions.slice(0, 2).forEach((direction) => {
      const neighbor = getNeighborInGrid(rooms, room, direction);
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
  // Guards are attached to shared door boundaries, so both sides see the same blocked passage.
  const stairsRoomIds = new Set([...context.allRoomIds].filter(roomId => {
    const room = findRoomInGrid(context.rooms, roomId);
    return room?.contents.some(content => content.type === "stairs");
  }));
  const doorwayConnections = getUniqueOpenConnections(context).filter(connection => {
    const neighborId = getConnectedRoomIdFromRooms(context.rooms, connection.roomId, connection.direction);
    return Boolean(neighborId) && connection.roomId !== context.startingRoomId && neighborId !== context.startingRoomId &&
      !stairsRoomIds.has(connection.roomId) && !stairsRoomIds.has(neighborId!);
  });
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
        context.level,
        context.playerCount,
      );

      placeDoorwayGuard(
        createMapFromContext(context),
        connection.roomId,
        connection.direction,
        monster,
      );
    });
}

function placeStairsEntranceGuards(context: DungeonGenerationContext) {
  const stairsRoom = [...context.allRoomIds]
    .map(roomId => findRoomInGrid(context.rooms, roomId))
    .find(room => room?.contents.some(content => content.type === "stairs"));
  if (!stairsRoom) return;

  getUniqueOpenConnections(context).forEach(connection => {
    const neighborId = getConnectedRoomIdFromRooms(context.rooms, connection.roomId, connection.direction);
    if (!neighborId) return;

    const guardsStairsRoom = connection.roomId === stairsRoom.id || neighborId === stairsRoom.id;
    if (!guardsStairsRoom) return;

    // Store the guard on the neighboring room's side, so it stands between the player and the stairs.
    const guardRoomId = connection.roomId === stairsRoom.id ? neighborId : connection.roomId;
    const guardDirection = connection.roomId === stairsRoom.id
      ? oppositeDirections[connection.direction]
      : connection.direction;
    const monster = createMonster(
      Object.keys(context.entities.monsters).length,
      `${guardRoomId}:${guardDirection}:stairs`,
      context.random,
      context.level,
      context.playerCount,
    );
    placeDoorwayGuard(createMapFromContext(context), guardRoomId, guardDirection, monster);
  });
}

function placeStairsFarthestFromEntrance(context: DungeonGenerationContext) {
  const currentStairsRoomId = [...context.allRoomIds].find(roomId =>
    findRoomInGrid(context.rooms, roomId)?.contents.some(content => content.type === "stairs"),
  );
  if (!currentStairsRoomId) return;
  const distances = getRoomDistances(context, context.startingRoomId);
  const farthestDistance = Math.max(...distances.values());
  const currentDistance = distances.get(currentStairsRoomId) ?? -1;
  if (currentDistance === farthestDistance) return;

  const candidates = [...distances.entries()].filter(([, distance]) => distance === farthestDistance);
  const preferred = candidates.filter(([roomId]) => getDeadEndRoomIds(context).includes(roomId));
  const choices = preferred.length ? preferred : candidates;
  const stairsRoomId = choices[Math.floor(context.random() * choices.length)]?.[0];
  if (!stairsRoomId) return;
  for (const roomId of context.allRoomIds) {
    const room = findRoomInGrid(context.rooms, roomId);
    if (!room) continue;
    room.contents = room.contents.filter(content => content.type !== "stairs");
    if (roomId === stairsRoomId) room.contents.push({ id: "stairs", label: "Stairs", type: "stairs" });
  }
}

function clearStairsRoomMonsters(context: DungeonGenerationContext) {
  const stairsRoom = [...context.allRoomIds]
    .map(roomId => findRoomInGrid(context.rooms, roomId))
    .find(room => room?.contents.some(content => content.type === "stairs"));
  if (!stairsRoom) return;
  const protectedIds = new Set<string>();
  for (const direction of Object.keys(directionDeltas) as Direction[]) {
    const neighbor = getNeighborInGrid(context.rooms, stairsRoom, direction);
    const neighborId = neighbor ? getRoomId(neighbor) : null;
    if (!neighborId || !context.allRoomIds.has(neighborId)) continue;
    for (const guard of Object.values(context.entities.doorwayGuards)) {
      if (guard.roomId === neighborId) protectedIds.add(guard.monsterId);
    }
  }
  stairsRoom.contents = stairsRoom.contents.filter(content => content.type !== "monster" || !protectedIds.has(content.id));
}

function ensureStartingRoomHasTwoDoorways(context: DungeonGenerationContext) {
  const startingRoom = findRoomInGrid(context.rooms, context.startingRoomId);
  if (!startingRoom) throw new Error(`Starting room ${context.startingRoomId} is missing`);

  let doorwayCount = (Object.keys(directionDeltas) as Direction[])
    .filter(direction => startingRoom[direction] !== "wall").length;
  for (const direction of Object.keys(directionDeltas) as Direction[]) {
    if (doorwayCount >= 2) break;
    if (startingRoom[direction] !== "wall") continue;
    const neighbor = getNeighborInGrid(context.rooms, startingRoom, direction);
    if (!neighbor) continue;
    const neighborId = getRoomId(neighbor);
    openConnection(context.rooms, startingRoom.id, direction);
    context.allRoomIds.add(neighborId);
    doorwayCount += 1;
  }

  if (doorwayCount < 2) {
    throw new Error(`Starting room ${startingRoom.id} cannot have two doorways`);
  }
}

function placeStairsAndStartingRoom(context: DungeonGenerationContext) {
  for (const roomId of context.allRoomIds) {
    const room = findRoomInGrid(context.rooms, roomId);
    if (room) room.contents = room.contents.filter(content => content.type !== "stairs");
  }
  // Put the exit as far from the entrance as the generated room graph allows.
  const distances = new Map<string, number>([[context.startingRoomId, 0]]);
  const queue = [context.startingRoomId];
  for (let index = 0; index < queue.length; index += 1) {
    const room = findRoomInGrid(context.rooms, queue[index]);
    if (!room) continue;
    for (const direction of Object.keys(directionDeltas) as Direction[]) {
      if (room[direction] === "wall") continue;
      const neighbor = getNeighborInGrid(context.rooms, room, direction);
      if (!neighbor) continue;
      const neighborId = getRoomId(neighbor);
      if (!context.allRoomIds.has(neighborId) || distances.has(neighborId)) continue;
      distances.set(neighborId, distances.get(room.id)! + 1);
      queue.push(neighborId);
    }
  }
  const stairsCandidates = [...distances.entries()]
    .filter(([roomId]) => roomId !== context.startingRoomId)
    .sort((left, right) => right[1] - left[1]);
  const farthestDistance = stairsCandidates[0]?.[1];
  const farthestRooms = stairsCandidates.filter(([roomId, distance]) =>
    distance === farthestDistance && getDeadEndRoomIds(context).includes(roomId),
  );
  const farthestSafeRooms = stairsCandidates.filter(([, distance]) => distance === farthestDistance);
  const stairsRoomId =
    (farthestRooms.length ? farthestRooms : farthestSafeRooms)[Math.floor(context.random() * (farthestRooms.length || farthestSafeRooms.length))]?.[0] ??
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
      const monsters = room.contents.filter((content): content is RoomMonsterRef => content.type === "monster");
      if (monsters.length) {
        const direction = (Object.keys(directionDeltas) as Direction[]).find(candidate => room[candidate] !== "wall");
        const neighbor = direction ? getNeighborInGrid(context.rooms, room, direction) : null;
        const neighborRoom = neighbor ? findRoomInGrid(context.rooms, getRoomId(neighbor)) : null;
        if (neighborRoom) {
          room.contents = room.contents.filter(content => content.type !== "monster");
          neighborRoom.contents.push(...monsters);
        }
      }
      room.contents.push({ id: "stairs", label: "Stairs", type: "stairs" } satisfies RoomStairsRef);
    }
  });
}

function clearDoorwayGuards(context: DungeonGenerationContext) {
  const guardIds = new Set(Object.keys(context.entities.doorwayGuards));
  for (const guard of Object.values(context.entities.doorwayGuards)) {
    const room = findRoomInGrid(context.rooms, guard.roomId);
    if (room?.[guard.direction] === "guarded") setConnectionBoundary(context.rooms, guard.roomId, guard.direction, "open");
  }
  context.entities.doorwayGuards = {};
  for (const guardId of guardIds) delete context.entities.monsters[guardId];
  for (const room of context.rooms.flat()) {
    room.contents = room.contents.filter(content => content.type !== "monster" || !guardIds.has(content.id));
  }
}

function lockRandomDoors(context: DungeonGenerationContext) {
  // Place a reachable key on the start side before locking a connection, preserving a solvable route.
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
  // Keep the werewolf unguarded and reachable, with its counter item placed in a different reachable room.
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
    const werewolf = createWerewolf(werewolfRoomId, context.level, context.playerCount);

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
  itemCount: number,
  equipmentCount: number,
) {
  // Keep floor reward counts stable, but use dead ends before ordinary rooms for chest placement.
  const candidates = shuffle(reachableRoomIds.filter(id => {
    const room = findRoomInGrid(context.rooms, id);
    return room && !room.isCurrentPosition && !room.contents.some(content => content.type === "stairs" || content.type === "item" || content.type === "equipment");
  }), context.random);
  const deadEndIds = new Set(getDeadEndRoomIds(context));
  const prioritizedCandidates = [
    ...candidates.filter(id => deadEndIds.has(id)),
    ...candidates.filter(id => !deadEndIds.has(id)),
  ];
  const itemKinds = ["health-potion", "energy-meal", ...(includeClock ? ["clock"] : [])];
  for (let index = 0; index < itemCount; index++) {
    placeItem(createMapFromContext(context), [prioritizedCandidates[index]], itemKinds[index % itemKinds.length], context.random);
  }
  const equipmentKinds = GAME_PARAMETERS.equipment.map(equipment => equipment.id);
  for (let index = 0; index < equipmentCount; index++) {
    const room = findRoomInGrid(context.rooms, prioritizedCandidates[itemCount + index]);
    if (!room) continue;
    const equipment = createEquipment(equipmentKinds[Math.floor(context.random() * equipmentKinds.length)], `equipment:${room.id}:${Math.floor(context.random() * 1_000_000)}`);
    context.entities.equipment[equipment.id] = equipment;
    room.contents.push({ id: equipment.id, isChest: true, type: "equipment" });
  }
}

function getDeadEndRoomIds(context: DungeonGenerationContext) {
  return [...context.allRoomIds].filter(roomId => {
    const room = findRoomInGrid(context.rooms, roomId);
    return room && (Object.keys(directionDeltas) as Direction[]).filter(direction => room[direction] !== "wall").length === 1;
  });
}

function getOptionalLootCounts(context: DungeonGenerationContext, reachableRoomIds: string[]) {
  // Guaranteed quest items (keys and silver arrows) occupy rooms, but are not
  // part of the floor's optional item/equipment budget. Scale expected loot
  // with the total generated room count, then cap placements to reachable,
  // empty rooms. Randomized rounding lets small floors roll fractional counts.
  const availableRoomCount = reachableRoomIds.filter(roomId => {
    const room = findRoomInGrid(context.rooms, roomId);
    return room && !room.isCurrentPosition && !room.contents.some(content =>
      content.type === "stairs" || content.type === "item" || content.type === "equipment",
    );
  }).length;
  const totalRoomCount = context.allRoomIds.size;
  const desiredItemCount = roundLootCount(totalRoomCount * GAME_PARAMETERS.dungeon.itemRoomChance, context.random);
  const desiredEquipmentCount = roundLootCount(totalRoomCount * GAME_PARAMETERS.dungeon.equipmentRoomChance, context.random);
  const itemCount = Math.min(availableRoomCount, desiredItemCount);
  const equipmentCount = Math.min(availableRoomCount - itemCount, desiredEquipmentCount);
  return { itemCount, equipmentCount };
}

function roundLootCount(expectedCount: number, random: () => number) {
  const wholeCount = Math.floor(expectedCount);
  const fractionalCount = expectedCount - wholeCount;
  return wholeCount + (fractionalCount > 0 && random() < fractionalCount ? 1 : 0);
}

function getRoomDistances(context: DungeonGenerationContext, originRoomId: string) {
  const distances = new Map<string, number>([[originRoomId, 0]]);
  const queue = [originRoomId];
  for (let index = 0; index < queue.length; index += 1) {
    const room = findRoomInGrid(context.rooms, queue[index]);
    if (!room) continue;
    for (const direction of Object.keys(directionDeltas) as Direction[]) {
      if (room[direction] === "wall") continue;
      const neighbor = getNeighborInGrid(context.rooms, room, direction);
      const neighborId = neighbor ? getRoomId(neighbor) : null;
      if (!neighborId || !context.allRoomIds.has(neighborId) || distances.has(neighborId)) continue;
      distances.set(neighborId, distances.get(room.id)! + 1);
      queue.push(neighborId);
    }
  }
  return distances;
}

function pruneEmptyDeadEnd(context: DungeonGenerationContext, roomId: string) {
  const room = findRoomInGrid(context.rooms, roomId);
  if (!room || room.id === context.startingRoomId
    || room.contents.some(content => content.type === "stairs" || content.type === "item" || content.type === "equipment")) return false;
  const direction = (Object.keys(directionDeltas) as Direction[]).find(candidate => room[candidate] !== "wall");
  if (!direction) return false;
  const neighbor = getNeighborInGrid(context.rooms, room, direction);
  const parentRoom = neighbor ? findRoomInGrid(context.rooms, getRoomId(neighbor)) : null;
  if (!neighbor || !parentRoom || parentRoom.contents.some(content => content.type === "stairs")) return false;
  const parentDegree = (Object.keys(directionDeltas) as Direction[]).filter(candidate => parentRoom[candidate] !== "wall").length;
  if (parentRoom.id === context.startingRoomId && parentDegree <= 2) return false;
  for (const [guardId, guard] of Object.entries(context.entities.doorwayGuards)) {
    const belongsToRemovedConnection = (guard.roomId === room.id && guard.direction === direction)
      || (guard.roomId === parentRoom.id && guard.direction === oppositeDirections[direction]);
    if (belongsToRemovedConnection) delete context.entities.doorwayGuards[guardId];
  }
  parentRoom.contents.push(...room.contents);
  setConnectionBoundary(context.rooms, room.id, direction, "wall");
  context.allRoomIds.delete(room.id);
  return true;
}

function limitDeadEndRooms(context: DungeonGenerationContext, maximumDeadEnds: number, reachableRoomIds: Set<string>) {
  while (getDeadEndRoomIds(context).length > maximumDeadEnds) {
    const deadEnds = new Set(getDeadEndRoomIds(context));
    const stairsRoomId = [...context.allRoomIds].find(roomId => findRoomInGrid(context.rooms, roomId)?.contents.some(content => content.type === "stairs"));
    const possibleLinks = [...context.allRoomIds].flatMap(roomId => {
      const room = findRoomInGrid(context.rooms, roomId);
      if (!room) return [];
      return (Object.keys(directionDeltas) as Direction[]).flatMap(direction => {
        if (room[direction] !== "wall") return [];
        const neighbor = getNeighborInGrid(context.rooms, room, direction);
        const neighborId = neighbor ? getRoomId(neighbor) : null;
        if (!neighborId || !context.allRoomIds.has(neighborId) || (!deadEnds.has(roomId) && !deadEnds.has(neighborId))) return [];
        if (roomId === stairsRoomId || neighborId === stairsRoomId) return [];
        const startDistances = getRoomDistances(context, context.startingRoomId);
        const stairsDistances = stairsRoomId ? getRoomDistances(context, stairsRoomId) : new Map<string, number>();
        const stairsDistance = stairsDistances.get(context.startingRoomId) ?? 0;
        const routeViaLink = Math.min(
          (startDistances.get(roomId) ?? Infinity) + 1 + (stairsDistances.get(neighborId) ?? Infinity),
          (startDistances.get(neighborId) ?? Infinity) + 1 + (stairsDistances.get(roomId) ?? Infinity),
        );
        if (routeViaLink < stairsDistance) return [];
        return [{ roomId, direction, neighborId, crossesBlockedBoundary: reachableRoomIds.has(roomId) !== reachableRoomIds.has(neighborId) }];
      });
    });
    const link = shuffle(possibleLinks, context.random)[0];
    if (link) {
      if (link.crossesBlockedBoundary) {
        const monster = createMonster(
          Object.keys(context.entities.monsters).length,
          `${link.roomId}:${link.direction}:dead-end-link`,
          context.random,
          context.level,
          context.playerCount,
        );
        placeDoorwayGuard(createMapFromContext(context), link.roomId, link.direction, monster);
      } else {
        openConnection(context.rooms, link.roomId, link.direction);
      }
      continue;
    }

    break;
  }
}

function moveExistingChestsIntoDeadEnds(context: DungeonGenerationContext) {
  const deadEnds = getDeadEndRoomIds(context);
  let movedKeyToRoom: string | null = null;
  for (const roomId of deadEnds) {
    const room = findRoomInGrid(context.rooms, roomId);
    if (!room || room.contents.some(content => content.type === "stairs" || ((content.type === "item" || content.type === "equipment") && content.isChest))) continue;
    const source = [...context.allRoomIds]
      .filter(candidateId => !deadEnds.includes(candidateId))
      .map(candidateId => findRoomInGrid(context.rooms, candidateId))
      .find(candidate => candidate && !candidate.isCurrentPosition && candidate.contents.some(content =>
        (content.type === "item" || content.type === "equipment") && content.isChest,
      ));
    const chest = source?.contents.find(content => (content.type === "item" || content.type === "equipment") && content.isChest);
    if (!source || !chest) continue;
    if (chest.type === "item" && context.entities.items[chest.id]?.itemId === "key") movedKeyToRoom = roomId;
    source.contents = source.contents.filter(content => content !== chest);
    room.contents.push(chest);
  }
  if (movedKeyToRoom) relocateLockedDoorForKey(context, movedKeyToRoom);
}

function relocateLockedDoorForKey(context: DungeonGenerationContext, keyRoomId: string) {
  const lockedConnections: RoomConnection[] = [];
  for (const roomId of context.allRoomIds) {
    const room = findRoomInGrid(context.rooms, roomId);
    if (!room) continue;
    for (const direction of Object.keys(directionDeltas) as Direction[]) {
      const neighbor = getNeighborInGrid(context.rooms, room, direction);
      if (room[direction] === "locked" && neighbor && roomId.localeCompare(getRoomId(neighbor)) < 0) {
        lockedConnections.push({ roomId, direction });
      }
    }
  }
  if (!lockedConnections.length) return;
  lockedConnections.forEach(connection => setConnectionBoundary(context.rooms, connection.roomId, connection.direction, "open"));
  const candidates = shuffle(getUniqueOpenConnections(context).filter(connection => {
    const room = findRoomInGrid(context.rooms, connection.roomId);
    const neighborId = room ? getConnectedRoomIdFromRooms(context.rooms, room.id, connection.direction) : null;
    if (!neighborId || room?.contents.some(content => content.type === "stairs")
      || findRoomInGrid(context.rooms, neighborId)?.contents.some(content => content.type === "stairs")) return false;
    return getReachableRoomIds(context.rooms, context.startingRoomId, connection).has(keyRoomId);
  }), context.random);
  const replacement = candidates[0] ?? lockedConnections[0];
  setConnectionBoundary(context.rooms, replacement.roomId, replacement.direction, "locked");
}

export function createDungeonMap(
  level: number,
  random: () => number,
  startingPosition?: GridPosition,
  includeClock = false,
  playerCount = 1,
  skipDeadEndAdjustment = false,
): DungeonMap {
  // Generation order is significant: connectivity precedes guards, exits, locks, and reachable-room loot.
  const maxRoomCount = Math.min(
    GAME_PARAMETERS.dungeon.maxRoomCount,
    GAME_PARAMETERS.dungeon.baseRoomCount +
      level +
      GAME_PARAMETERS.dungeon.extraRoomCountRange - 1,
  );
  const { columns, rows } = getLevelGridBounds(level);
  const rooms = createEmptyGrid(columns, rows);
  const entities = {
    items: {} as Record<string, WorldItem>,
    equipment: {} as Record<string, WorldEquipment>,
    doorwayGuards: {} as Record<string, DoorwayGuard>,
    monsters: {} as Record<string, WorldMonster>,
  };
  const finalStartingPosition = startingPosition ?? {
    column: columns[Math.floor(random() * columns.length)],
    row: rows[Math.floor(random() * rows.length)],
  };
  if (!columns.includes(finalStartingPosition.column) || !rows.includes(finalStartingPosition.row)) {
    throw new Error(`Starting position ${getRoomId(finalStartingPosition)} is outside the level ${level} grid`);
  }
  const startingRoomId = getRoomId(finalStartingPosition);
  const allRoomIds = new Set([startingRoomId]);
  const context: DungeonGenerationContext = {
    allRoomIds,
    entities,
    level,
    roomLimit: maxRoomCount,
    columns,
    playerCount: Math.max(1, Math.floor(playerCount)),
    random,
    rooms,
    rows,
    startingRoomId,
  };
  const totalRooms = Math.min(
    GAME_PARAMETERS.dungeon.maxRoomCount,
    columns.length * rows.length,
    maxRoomCount,
    GAME_PARAMETERS.dungeon.baseRoomCount +
      level +
      Math.floor(random() * GAME_PARAMETERS.dungeon.extraRoomCountRange),
  );

  growRoomNetwork(context, totalRooms);
  addExtraRoomConnections(context);
  ensureStartingRoomHasTwoDoorways(context);
  placeStairsAndStartingRoom(context);
  placeDoorwayGuards(context);
  placeStairsEntranceGuards(context);
  lockRandomDoors(context);

  const reachableRoomIds = [...getReachableRoomIds(rooms, startingRoomId)];

  placeWerewolfAndSilverBullet(context, reachableRoomIds);
  const lootCounts = getOptionalLootCounts(context, reachableRoomIds);
  const deadEnds = new Set(getDeadEndRoomIds(context));
  const questChestCount = [...context.allRoomIds].reduce((count, roomId) => {
    const room = findRoomInGrid(rooms, roomId);
    return count + (room?.contents.filter(content =>
      (content.type === "item" || content.type === "equipment") && content.isChest,
    ).length ?? 0);
  }, 0);
  const stairsCount = [...deadEnds].filter(roomId => findRoomInGrid(rooms, roomId)?.contents.some(content => content.type === "stairs")).length;
  const reachableSet = new Set(reachableRoomIds);
  if (!skipDeadEndAdjustment) {
    // Reserve the stair room as a dead end, then keep the remaining leaves within
    // the existing chest budget. Loot placement below prioritizes those leaves.
    limitDeadEndRooms(context, questChestCount + lootCounts.itemCount + lootCounts.equipmentCount + 1, reachableSet);
    clearDoorwayGuards(context);
    placeStairsAndStartingRoom(context);
    placeDoorwayGuards(context);
    placeStairsEntranceGuards(context);
  }
  placeOptionalLoot(context, reachableRoomIds, includeClock, lootCounts.itemCount, lootCounts.equipmentCount);
  if (!skipDeadEndAdjustment) {
    for (let attempt = 0; attempt < context.roomLimit; attempt += 1) {
      const deadEnds = getDeadEndRoomIds(context);
      const chestCount = [...context.allRoomIds].reduce((count, roomId) => {
        const room = findRoomInGrid(rooms, roomId);
        return count + (room?.contents.filter(content =>
          (content.type === "item" || content.type === "equipment") && content.isChest,
        ).length ?? 0);
      }, 0);
      const stairsDeadEndCount = deadEnds.filter(roomId => findRoomInGrid(rooms, roomId)?.contents.some(content => content.type === "stairs")).length;
      const unfilledDeadEnds = deadEnds.filter(roomId => {
        const room = findRoomInGrid(rooms, roomId);
        return !room?.contents.some(content => content.type === "stairs" || ((content.type === "item" || content.type === "equipment") && content.isChest));
      });
      if (!unfilledDeadEnds.length && deadEnds.length <= chestCount + stairsDeadEndCount) break;
      if (unfilledDeadEnds.length) {
        const removableUnfilled = unfilledDeadEnds.find(roomId => pruneEmptyDeadEnd(context, roomId));
        if (removableUnfilled) continue;
      }
      if (deadEnds.length > chestCount + stairsDeadEndCount) {
        const stairsRoomId = [...context.allRoomIds].find(id => findRoomInGrid(rooms, id)?.contents.some(content => content.type === "stairs"));
        const link = deadEnds.flatMap(roomId => {
          const room = findRoomInGrid(rooms, roomId);
          if (!room || roomId === stairsRoomId) return [];
          return (Object.keys(directionDeltas) as Direction[]).flatMap(direction => {
            if (room[direction] !== "wall") return [];
            const neighbor = getNeighborInGrid(rooms, room, direction);
            const neighborId = neighbor ? getRoomId(neighbor) : null;
            if (!neighborId || !context.allRoomIds.has(neighborId) || neighborId === stairsRoomId) return [];
            return [{ roomId, direction }];
          });
        })[0];
        if (link) {
          openConnection(rooms, link.roomId, link.direction);
          continue;
        }
        const removable = deadEnds.find(roomId => roomId !== stairsRoomId && pruneEmptyDeadEnd(context, roomId));
        if (removable) continue;
        break;
      }
      break;
    }
    clearDoorwayGuards(context);
    placeDoorwayGuards(context);
    moveExistingChestsIntoDeadEnds(context);
    placeStairsFarthestFromEntrance(context);
    placeStairsEntranceGuards(context);
    clearStairsRoomMonsters(context);
  }

  return createMapFromContext(context);
}
