import { getNeighbor, getRoomId, getGridPosition, type Direction, type DungeonMap, type GridPosition } from "@/game/dungeon/types";
import { getRoom, hasRoomStairs, moveCurrentPosition, revealRooms, unlockDoor } from "@/game/dungeon/rooms";

export type RoomMovement = { map: DungeonMap; roomId: string; nextRoomId: string; openedLock: boolean; usedKey: boolean; startingPosition: GridPosition | null };

/** Resolves one doorway action without mutating the source map. */
export function resolveRoomMovement({
  canUseKey,
  direction,
  isThief,
  isCharged = false,
  map,
  revealAdjacent,
  roomId,
}: {
  canUseKey: boolean;
  direction: Direction;
  isThief: boolean;
  isCharged?: boolean;
  map: DungeonMap;
  revealAdjacent: boolean;
  roomId: string;
}): RoomMovement | null {
  const room = getRoom(map, roomId);
  const boundary = room[direction];
  if (boundary === "wall" || boundary === "guarded") return null;

  const neighbor = getNeighbor(room, direction);
  if (!neighbor) return null;
  const nextRoomId = getRoomId(neighbor);
  getRoom(map, nextRoomId);

  const openedLock = boundary === "locked";
  if (openedLock && !isThief && !canUseKey) return null;
  const thiefNeedsSeparateMove = openedLock && isThief && !canUseKey && !isCharged;

  const unlockedMap = openedLock ? unlockDoor(map, roomId, direction) : map;

  const destinationId = thiefNeedsSeparateMove ? roomId : nextRoomId;
  const destination = getRoom(unlockedMap, destinationId);
  const movedMap = thiefNeedsSeparateMove ? unlockedMap : moveCurrentPosition(unlockedMap, destinationId);
  const positionedMap = {
    ...movedMap,
    rooms: movedMap.rooms.map((row) => row.map((candidate) => ({
      ...candidate,
      isCurrentPosition: candidate.id === destinationId,
    }))),
  };
  return {
    map: revealRooms(positionedMap, destinationId, revealAdjacent),
    roomId: destinationId,
    nextRoomId: destinationId,
    openedLock,
    usedKey: openedLock && canUseKey && !isThief,
    startingPosition: !thiefNeedsSeparateMove && hasRoomStairs(destination) ? getGridPosition(destinationId) : null,
  };
}
