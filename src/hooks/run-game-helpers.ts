import type { Dispatch, SetStateAction } from "react";
import type { CombatAnimationFrame } from "@/entities";
import { addItemToRoom, removeItemFromRoom } from "@/utils/dungeon-map-runtime";
import type { DungeonMap, ItemId } from "@/utils/dungeon-map";

// Compatibility entry point. New code should import from the responsibility-specific modules.
export { createLevelMap, getNextLevelState, getPlayerAttackDamage } from "@/hooks/run-game-level";
export {
  canUseInventoryItem, getInventoryItemActivationDescription, getInventoryItemSprite,
  getItemLabel, recoverStat, resetRoomFeedback, resolveEnergyLoss, resolveHealthLoss,
  resolveTurnLoss,
} from "@/hooks/run-game-items";
export { getCurrentEnemy, getRunSnapshot } from "@/hooks/run-game-snapshot";
export { getRoomDoorways, getRoomSceneActors } from "@/hooks/run-game-scene";
export { getTurnStatus } from "@/hooks/run-game-status";
export { defaultRoomDoorways, directionScenePositions, playerEntryPositions, PLAYER_MAX_ENERGY, PLAYER_MAX_HEALTH } from "@/hooks/run-game-types";
export type { UseGameRunOptions } from "@/hooks/run-game-types";

export function restartAnimations(
  setFrame: Dispatch<SetStateAction<CombatAnimationFrame>>,
  animationKeys: (keyof Omit<CombatAnimationFrame, "bounceElapsed">)[],
) {
  setFrame(frame => {
    const nextFrame = { ...frame };
    animationKeys.forEach(key => { nextFrame[key] = 0; });
    return nextFrame;
  });
}

export function swapRoomItemWithInventory({ currentRoomId, currentRoomItemId, dungeonMap, inventoryItem }: {
  currentRoomId: string; currentRoomItemId: ItemId; dungeonMap: DungeonMap; inventoryItem: ItemId | null;
}) {
  const mapWithoutPickedItem = removeItemFromRoom(dungeonMap, currentRoomId, currentRoomItemId);
  return inventoryItem ? addItemToRoom(mapWithoutPickedItem, currentRoomId, inventoryItem) : mapWithoutPickedItem;
}
