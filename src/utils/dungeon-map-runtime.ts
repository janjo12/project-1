import {
  createEquipment,
  createItem,
  getDoorwayGuardPlacements,
  getGridPosition,
  getNeighbor,
  getRoomId,
  oppositeDirections,
  type Direction,
  type DungeonMap,
  type DungeonRoom,
  type EquipmentId,
  type ItemId,
  type RoomContents,
  type RoomItemRef,
  type RoomMonsterRef,
  type WorldMonster,
} from "@/utils/dungeon-map";

const DIRECTIONS: Direction[] = ["north", "east", "south", "west"];

function findRoomLocation(map: DungeonMap, roomId: string) {
  for (const [rowIndex, row] of map.rooms.entries()) {
    const roomIndex = row.findIndex((room) => room.id === roomId);

    if (roomIndex !== -1) {
      return { room: row[roomIndex], rowIndex, roomIndex };
    }
  }

  return null;
}

export function getRooms(map: DungeonMap) {
  return map.rooms.flat();
}

export function getRoom(map: DungeonMap, roomId: string) {
  return findRoomLocation(map, roomId)?.room;
}

export function getCurrentRoom(map: DungeonMap) {
  for (const row of map.rooms) {
    const room = row.find((candidate) => candidate.isCurrentPosition);

    if (room) {
      return room;
    }
  }

  return undefined;
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
  return DIRECTIONS.filter(
    (direction) => getConnectedRoomId(map, roomId, direction) !== null,
  );
}

export function getLockedDirections(map: DungeonMap, roomId: string) {
  const room = getRoom(map, roomId);

  if (!room) {
    return [];
  }

  return DIRECTIONS.filter((direction) => room[direction] === "locked");
}

export function getGuardedDirections(map: DungeonMap, roomId: string) {
  const room = getRoom(map, roomId);

  if (!room) {
    return [];
  }

  return DIRECTIONS.filter((direction) => room[direction] === "guarded");
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
    ...DIRECTIONS
      .flatMap((direction) => getDoorwayGuardPlacements(map, room.id, direction))
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

export function getRoomEquipment(map: DungeonMap, room: DungeonRoom | undefined) {
  const ref = room?.contents.find((content) => content.type === "equipment");
  return ref?.type === "equipment" ? map.entities.equipment?.[ref.id] ?? null : null;
}

export function revealRooms(map: DungeonMap, currentRoomId: string, revealAdjacent = false): DungeonMap {
  const current = getRoom(map, currentRoomId);
  const adjacentIds = new Set<string>();
  if (revealAdjacent && current) DIRECTIONS.forEach(direction => {
    const neighbor = getNeighbor(current, direction);
    if (neighbor) adjacentIds.add(getRoomId(neighbor));
  });
  return { ...map, rooms: map.rooms.map(row => row.map(room => ({
    ...room, isCurrentPosition: room.id === currentRoomId,
    isRevealed: room.id === currentRoomId || adjacentIds.has(room.id) || (!revealAdjacent && room.isRevealed),
  }))) };
}

export function hasRoomStairs(room: DungeonRoom | undefined) {
  return Boolean(room?.contents.some((content) => content.type === "stairs"));
}

export function getStairsRoom(map: DungeonMap) {
  for (const row of map.rooms) {
    const room = row.find(hasRoomStairs);

    if (room) {
      return room;
    }
  }

  return undefined;
}

export function unlockDoor(
  map: DungeonMap,
  roomId: string,
  direction: Direction,
): DungeonMap {
  const sourceLocation = findRoomLocation(map, roomId);
  const neighbor = sourceLocation
    ? getNeighbor(sourceLocation.room, direction)
    : null;
  const neighborId = neighbor ? getRoomId(neighbor) : null;

  return {
    ...map,
    rooms: map.rooms.map((row) =>
      row.map((room) => {
        if (room.id === roomId) return { ...room, [direction]: "open" };
        if (neighborId && room.id === neighborId) {
          return { ...room, [oppositeDirections[direction]]: "open" };
        }
        return room;
      }),
    ),
  };
}

export function moveCurrentPosition(map: DungeonMap, nextRoomId: string) {
  const previousRoomId = map.rooms.flat().find(room => room.isCurrentPosition)?.id;
  const next = revealRooms(map, nextRoomId, false);
  if (!previousRoomId) return next;
  return { ...next, rooms: next.rooms.map(row => row.map(room => room.id === previousRoomId ? { ...room, isRevealed: true } : room)) };
}

export function removeEquipmentFromRoom(map: DungeonMap, roomId: string, id: string) {
  const equipment = map.entities.equipment?.[id];
  if (!equipment) return map;
  const { [id]: _removed, ...remaining } = map.entities.equipment ?? {};
  return { ...map, entities: { ...map.entities, equipment: remaining }, rooms: map.rooms.map(row => row.map(room => room.id === roomId
    ? { ...room, contents: room.contents.filter(content => !(content.type === "equipment" && content.id === id)) } : room)) };
}

export function addEquipmentToRoom(map: DungeonMap, roomId: string, equipmentId: EquipmentId) {
  const equipment = createEquipment(equipmentId, `${equipmentId}:${roomId}:${Date.now()}:${Math.floor(Math.random() * 1_000_000)}`);
  return { ...map, entities: { ...map.entities, equipment: { ...map.entities.equipment, [equipment.id]: equipment } },
    rooms: map.rooms.map(row => row.map(room => room.id === roomId ? { ...room, contents: [...room.contents, { id: equipment.id, type: "equipment" as const }] } : room)) };
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

  const otherLivingGuards = getDoorwayGuardPlacements(nextMap, doorwayGuard.roomId, doorwayGuard.direction)
    .some((guard) => guard.monsterId !== monsterId && (nextMap.entities.monsters[guard.monsterId]?.currentHealth ?? 0) > 0);
  if (otherLivingGuards) {
    const { [monsterId]: removed, ...remaining } = nextMap.entities.doorwayGuards;
    return { ...nextMap, entities: { ...nextMap.entities, doorwayGuards: remaining } };
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
  return map.rooms.flatMap((row) =>
    row.filter(
      (room) =>
        room.isRevealed ||
        room.contents.length > 0 ||
        DIRECTIONS.some((direction) => room[direction] === "open" || room[direction] === "guarded"),
    ),
  );
}

export function getRoomPosition(roomId: string) {
  return getGridPosition(roomId);
}
//#endregion
