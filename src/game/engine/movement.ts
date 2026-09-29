import type { Direction, DungeonMap, GridPosition } from "@/game/dungeon/types";
import { getGridPosition } from "@/game/dungeon/types";
import {
  getConnectedRoomId,
  getRoom,
  hasRoomStairs,
  moveCurrentPosition,
  revealRooms,
  unlockDoor,
} from "@/game/dungeon/rooms";

export type RoomMovement = {
  map: DungeonMap;
  nextRoomId: string;
  usedKey: boolean;
  startingPosition: GridPosition | null;
};

export function resolveRoomMovement({
  canUseKey,
  direction,
  isThief,
  map,
  revealAdjacent,
  roomId,
}: {
  canUseKey: boolean;
  direction: Direction;
  isThief: boolean;
  map: DungeonMap;
  revealAdjacent: boolean;
  roomId: string;
}): RoomMovement | null {
  // Unlock before resolving the destination so keys and the thief's lock-pick can use the same path.
  const isLocked = getRoom(map, roomId)?.[direction] === "locked";
  const usedKey = canUseKey && !isThief && isLocked;
  const pickedLock = isThief && isLocked;
  const opensDoor = usedKey || pickedLock;
  const openedMap = opensDoor ? unlockDoor(map, roomId, direction) : map;
  const nextRoomId = getConnectedRoomId(openedMap, roomId, direction);
  const nextRoom = nextRoomId ? getRoom(openedMap, nextRoomId) : undefined;

  // A missing connection stays an invalid move, even if an attempted unlock changed a temporary map.
  if (!nextRoomId || !nextRoom) return null;

  return {
    map: revealRooms(moveCurrentPosition(openedMap, nextRoomId), nextRoomId, revealAdjacent),
    nextRoomId,
    usedKey,
    // Entering a stairs room starts at its center; other rooms preserve normal entry placement.
    startingPosition: hasRoomStairs(nextRoom) ? getGridPosition(nextRoomId) : null,
  };
}

export { getConnectedRoomId, moveCurrentPosition, unlockDoor };
