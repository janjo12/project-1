import type { Dispatch, SetStateAction } from "react";
import type { CombatAnimationFrame } from "@/game/entities";
import { addItemToRoom, removeItemFromRoom } from "@/game/dungeon/rooms";
import type { DungeonMap, ItemId } from "@/game/dungeon/types";

// Compatibility entry point. New code should import from the responsibility-specific modules.
export { createLevelMap, getNextLevelState, getPlayerAttackDamage } from "@/game/engine/run-game-level";
export {
  canUseInventoryItem, getInventoryItemActivationDescription, getInventoryItemSprite,
  getItemLabel, recoverStat, resetRoomFeedback, resolveEnergyLoss, resolveHealthLoss,
} from "@/game/actions/items";
export { resolveTurnLoss } from "@/game/engine/resolveTurn";
export { getCurrentEnemy, getRunSnapshot } from "@/game/engine/run-game-snapshot";
export { getRoomDoorways, getRoomSceneActors } from "@/game/engine/run-game-scene";
export { getTurnStatus } from "@/game/engine/run-game-status";
export { defaultRoomDoorways, directionScenePositions, playerEntryPositions, PLAYER_MAX_ENERGY, PLAYER_MAX_HEALTH } from "@/game/state/types";
export type { UseGameRunOptions } from "@/game/state/types";

export function restartAnimations(
  setFrame: Dispatch<SetStateAction<CombatAnimationFrame>>,
  animationKeys: (keyof CombatAnimationFrame)[],
) {
  // Restart only the requested one-shot channels.
  setFrame(frame => {
    const nextFrame = { ...frame };
    animationKeys.forEach(key => { nextFrame[key] = 0; });
    return nextFrame;
  });
}

export function swapRoomItemWithInventory({ currentRoomId, currentRoomItemId, dungeonMap, inventoryItem }: {
  currentRoomId: string; currentRoomItemId: ItemId; dungeonMap: DungeonMap; inventoryItem: ItemId | null;
}) {
  // Picking up a new item drops the held one into the same room before updating inventory state.
  const mapWithoutPickedItem = removeItemFromRoom(dungeonMap, currentRoomId, currentRoomItemId);
  return inventoryItem ? addItemToRoom(mapWithoutPickedItem, currentRoomId, inventoryItem) : mapWithoutPickedItem;
}
