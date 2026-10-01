import type { DungeonMap } from "@/game/dungeon/types";
import { getRoom } from "@/game/dungeon/rooms";
import { getAttackTarget } from "@/game/engine/targeting";
import { resolveRoomMovement } from "@/game/engine/movement";
import type { GameAction } from "@/game/actions/actions";

export function validateAction({
  action,
  canUseKey,
  currentRoomId,
  isThief = false,
  map,
}: {
  action: GameAction;
  canUseKey: boolean;
  currentRoomId: string;
  isThief?: boolean;
  map: DungeonMap;
}): boolean {
  // Validate against current map state so stale UI targets cannot perform impossible actions.
  if (action.type === "MOVE") {
    return resolveRoomMovement({
      canUseKey,
      direction: action.direction,
      isThief,
      map,
      revealAdjacent: false,
      roomId: currentRoomId,
    }) !== null;
  }

  if (action.type === "ATTACK") {
    return getAttackTarget(map, currentRoomId, action.monsterId) !== null;
  }

  const room = getRoom(map, currentRoomId);
  if (action.type === "PICKUP") return room.contents.some((content) => content.type === "item" || content.type === "equipment");
  if (action.type === "DESCEND") return room.contents.some((content) => content.type === "stairs");
  return true;
}
