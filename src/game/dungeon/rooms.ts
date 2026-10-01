import { createEquipment, createItem } from "@/game/entities/items";
import {
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
} from "@/game/dungeon/types";

const DIRECTIONS: Direction[] = ["north", "east", "south", "west"];

function findRoomLocation(map: DungeonMap, roomId: string) {
  for (const [rowIndex, row] of map.rooms.entries()) {
    const roomIndex = row.findIndex((room) => room.id === roomId);

    if (roomIndex !== -1) {
      return { room: row[roomIndex], rowIndex, roomIndex };
    }
  }

  throw new Error(`Room ${roomId} is missing from the dungeon map`);
}

export function getRooms(map: DungeonMap) {
  return map.rooms.flat();
}

export function getRoom(map: DungeonMap, roomId: string) {
  return findRoomLocation(map, roomId).room;
}

export function getCurrentRoom(map: DungeonMap) {
  for (const row of map.rooms) {
    const room = row.find((candidate) => candidate.isCurrentPosition);

    if (room) {
      return room;
    }
  }

  throw new Error("Dungeon map has no current room");
}

export function getCurrentRoomId(map: DungeonMap) {
  return getCurrentRoom(map).id;
}

export function getConnectedRoomId(
  map: DungeonMap,
  roomId: string,
  direction: Direction,
) {
  // Only open doorways connect rooms; locked and guarded edges remain impassable here.
  const room = getRoom(map, roomId);

  if (room[direction] !== "open") {
    return null;
  }

  const neighbor = getNeighbor(room, direction);

  if (!neighbor) {
    return null;
  }

  return getRoom(map, getRoomId(neighbor)).id;
}

export function getOpenDirections(map: DungeonMap, roomId: string) {
  return DIRECTIONS.filter(
    (direction) => getConnectedRoomId(map, roomId, direction) !== null,
  );
}

export function getLockedDirections(map: DungeonMap, roomId: string) {
  const room = getRoom(map, roomId);

  return DIRECTIONS.filter((direction) => room[direction] === "locked");
}

export function getGuardedDirections(map: DungeonMap, roomId: string) {
  const room = getRoom(map, roomId);

  return DIRECTIONS.filter((direction) => room[direction] === "guarded");
}

function prioritizeRoomContentsForTargeting(map: DungeonMap, contents: RoomContents) {
  return [...contents].sort((left, right) => {
    const leftMonster = left.type === "monster" ? map.entities.monsters[left.id] : undefined;
    const rightMonster = right.type === "monster" ? map.entities.monsters[right.id] : undefined;
    if (left.type === "monster" && !leftMonster) throw new Error(`Room content references missing monster ${left.id}`);
    if (right.type === "monster" && !rightMonster) throw new Error(`Room content references missing monster ${right.id}`);

    return (
      Number(Boolean(leftMonster?.chases)) -
      Number(Boolean(rightMonster?.chases))
    );
  });
}

export function getTargetableRoomMonsterRefs(
  map: DungeonMap,
  room: DungeonRoom,
) {
  return prioritizeRoomContentsForTargeting(map, room.contents).filter(
    (content): content is RoomMonsterRef => {
      if (content.type !== "monster") return false;
      const monster = map.entities.monsters[content.id];
      if (!monster) throw new Error(`Room ${room.id} references missing monster ${content.id}`);
      return monster.currentHealth > 0;
    },
  );
}

function getLivingMonster(map: DungeonMap, monsterId: string) {
  const monster = map.entities.monsters[monsterId];
  if (!monster) throw new Error(`Dungeon map is missing monster ${monsterId}`);
  return monster.currentHealth > 0 ? monster : null;
}

export function getTargetableMonsters(
  map: DungeonMap,
  room: DungeonRoom,
) {
  const monsters = [
    ...getTargetableRoomMonsterRefs(map, room)
      .map((monsterRef) => getLivingMonster(map, monsterRef.id))
      .filter((monster): monster is WorldMonster => Boolean(monster)),
    ...DIRECTIONS
      .flatMap((direction) => getDoorwayGuardPlacements(map, room.id, direction))
      .map((guard) => getLivingMonster(map, guard.monsterId))
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

export function getRoomMonster(map: DungeonMap, room: DungeonRoom) {
  return getTargetableMonsters(map, room)[0] ?? null;
}

export function getWerewolf(map: DungeonMap) {
  return (
    Object.values(map.entities.monsters).find(
      (monster) => monster.chases && monster.currentHealth > 0,
    ) ?? null
  );
}

function getItemFromRoom(map: DungeonMap, room: DungeonRoom) {
  const itemRef = room.contents.find((content) => content.type === "item");
  if (!itemRef) return null;
  const item = map.entities.items[itemRef.id];
  if (!item) throw new Error(`Room ${room.id} references missing item ${itemRef.id}`);
  return item;
}

export function getRoomItem(map: DungeonMap, room: DungeonRoom) {
  return getItemFromRoom(map, room);
}

export function getRoomItemId(map: DungeonMap, room: DungeonRoom) {
  return getRoomItem(map, room)?.itemId ?? null;
}

export function getRoomEquipment(map: DungeonMap, room: DungeonRoom) {
  const ref = room.contents.find((content) => content.type === "equipment");
  if (!ref) return null;
  const equipment = map.entities.equipment[ref.id];
  if (!equipment) throw new Error(`Room ${room.id} references missing equipment ${ref.id}`);
  return equipment;
}

export function revealRooms(map: DungeonMap, currentRoomId: string, revealAdjacent = false): DungeonMap {
  // Reveal the entered room and optionally its neighbors, as used by the spyglass.
  const current = getRoom(map, currentRoomId);
  const adjacentIds = new Set<string>();
  if (revealAdjacent) DIRECTIONS.forEach(direction => {
    const neighbor = getNeighbor(current, direction);
    if (neighbor) adjacentIds.add(getRoomId(neighbor));
  });
  return { ...map, rooms: map.rooms.map(row => row.map(room => ({
    ...room, isCurrentPosition: room.id === currentRoomId,
    isRevealed: room.id === currentRoomId || adjacentIds.has(room.id) || (!revealAdjacent && room.isRevealed),
  }))) };
}

export function hasRoomStairs(room: DungeonRoom) {
  return room.contents.some((content) => content.type === "stairs");
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
  const neighbor = getNeighbor(sourceLocation.room, direction);
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
  const previousRoomId = getCurrentRoom(map).id;
  const next = revealRooms(map, nextRoomId, false);
  return { ...next, rooms: next.rooms.map(row => row.map(room => room.id === previousRoomId ? { ...room, isRevealed: true } : room)) };
}

export function removeEquipmentFromRoom(map: DungeonMap, roomId: string, id: string) {
  const equipment = map.entities.equipment[id];
  if (!equipment) throw new Error(`Dungeon map is missing equipment ${id}`);
  const { [id]: _removed, ...remaining } = map.entities.equipment;
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
  // Guarded passages reopen only after every monster guarding that shared boundary is defeated.
  const nextMonster = map.entities.monsters[monsterId];

  if (!nextMonster) throw new Error(`Dungeon map is missing monster ${monsterId}`);

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
    .some((guard) => {
      const guardMonster = nextMap.entities.monsters[guard.monsterId];
      if (!guardMonster) throw new Error(`Doorway guard references missing monster ${guard.monsterId}`);
      return guard.monsterId !== monsterId && guardMonster.currentHealth > 0;
    });
  if (otherLivingGuards) {
    const { [monsterId]: removed, ...remaining } = nextMap.entities.doorwayGuards;
    return { ...nextMap, entities: { ...nextMap.entities, doorwayGuards: remaining } };
  }

  const sourceRoom = getRoom(nextMap, doorwayGuard.roomId);
  const neighbor = getNeighbor(sourceRoom, doorwayGuard.direction);

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
  getRoom(map, roomId);

  return {
    ...map,
    rooms: map.rooms.map((row) =>
      row.map((room) => {
        const contentsWithoutWerewolf = room.contents.filter(
          (content) =>
            content.type !== "monster" ||
            (() => {
              if (content.type !== "monster") return true;
              const monster = map.entities.monsters[content.id];
              if (!monster) throw new Error(`Room ${room.id} references missing monster ${content.id}`);
              return !monster.chases;
            })(),
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
