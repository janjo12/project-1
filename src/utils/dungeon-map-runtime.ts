import {
  createItem,
  directionDeltas,
  getDoorwayGuardPlacements,
  getGridPosition,
  getNeighbor,
  getRoomId,
  oppositeDirections,
  type Direction,
  type DungeonMap,
  type DungeonRoom,
  type ItemId,
  type RoomContents,
  type RoomItemRef,
  type RoomMonsterRef,
  type WorldMonster,
} from "@/utils/dungeon-map";

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
