import { POSSIBLE_EQUIPMENT, type DungeonMap, type ItemId, type WorldMonster } from "@/utils/dungeon-map";
import { getConnectedRoomId, getCurrentRoom, getCurrentRoomId, getRoom, getRoomItem, getRoomItemId, getRoomMonster, getRoomEquipment, hasRoomStairs, revealRooms } from "@/utils/dungeon-map-runtime";
import { getTurnDuration, hasTurnLimit, hasTurnTimer } from "@/hooks/run-game-policies";
import { canUseInventoryItem, getInventoryItemActivationDescription, getInventoryItemSprite, getItemLabel, getEquipmentDescription, getEquipmentLabel } from "@/hooks/run-game-items";
import { getRoomDoorways, getRoomSceneActors } from "@/hooks/run-game-scene";
import { getTurnStatus } from "@/hooks/run-game-status";
import type { Difficulty } from "@/utils/settings-storage";

export function getCurrentEnemy(monster: WorldMonster | null) {
  return monster ? { sprite: monster.sprite, hitPoints: monster.currentHealth, name: monster.name } : null;
}

export function getRunSnapshot({
  activeMonsterId, clearedLevels, difficulty, dungeonMap, inventoryItem, isResolving,
  equipment, level, playerEnergy, playerHealth, turnCounter,
}: {
  activeMonsterId: string | null; clearedLevels: number; difficulty: Difficulty; dungeonMap: DungeonMap;
  inventoryItem: ItemId | null; equipment: string | null; isResolving: boolean; level: number; playerEnergy: number;
  playerHealth: number; turnCounter: number;
}) {
  const currentRoom = getCurrentRoom(dungeonMap) ?? getRoom(dungeonMap, dungeonMap.startingRoomId);
  const currentRoomId = currentRoom?.id ?? getCurrentRoomId(dungeonMap);
  const currentRoomItem = getRoomItemId(dungeonMap, currentRoom);
  const currentRoomItemObject = getRoomItem(dungeonMap, currentRoom);
  const currentRoomEquipment = getRoomEquipment(dungeonMap, currentRoom);
  const currentMonster = getRoomMonster(dungeonMap, currentRoom);
  const hasRoomEnemy = Boolean(currentMonster);
  const hasHardTurnCounter = hasTurnLimit(difficulty);
  const hasLost = playerHealth <= 0 || (hasHardTurnCounter && turnCounter <= 0);
  return {
    currentEnemy: getCurrentEnemy(currentMonster),
    currentEnemyMaxHitPoints: currentMonster?.maximumHealth ?? 1,
    currentMonster, currentRoom, currentRoomId, currentRoomItem, currentRoomEquipment,
    currentRoomItemLabel: getItemLabel(currentRoomItem), currentRoomItemObject,
    currentRoomItemSprite: currentRoomItemObject?.sprite ?? null,
    disabledDirections: getDisabledDirections(dungeonMap, inventoryItem, isResolving, currentRoomId),
    hasHardTurnCounter, hasLost, hasRoomEnemy, hasTurnTimer: hasTurnTimer(difficulty),
    inventoryItemLabel: getItemLabel(inventoryItem),
    inventoryItemActivationDescription: getInventoryItemActivationDescription(inventoryItem),
    inventoryItemSprite: getInventoryItemSprite(inventoryItem),
    equipmentLabel: getEquipmentLabel(equipment),
    equipmentDescription: getEquipmentDescription(equipment),
    equipmentSprite: equipment ? POSSIBLE_EQUIPMENT.find(item => item.equipmentId === equipment)?.sprite ?? null : null,
    isItemDisabled: isResolving || hasLost || !canUseInventoryItem({
      currentRoomId, dungeonMap, inventoryItem, monster: currentMonster, playerEnergy, playerHealth,
    }),
    visibleDungeonMap: equipment === "spyglass" ? revealRooms(dungeonMap, currentRoomId, true) : dungeonMap,
    roomDoorways: getRoomDoorways(currentRoom),
    roomHasStairs: currentRoom ? hasRoomStairs(currentRoom) : false,
    roomSceneActors: getRoomSceneActors({ currentMonsterId: activeMonsterId ?? currentMonster?.id ?? null, dungeonMap, room: currentRoom }),
    turnDuration: getTurnDuration({ difficulty, level }),
    turnStatus: getTurnStatus({ hasRoomEnemy, hasLost, isResolving, level, roomId: currentRoomId, clearedLevels }),
  };
}

function getDisabledDirections(dungeonMap: DungeonMap, inventoryItem: ItemId | null, isResolving: boolean, roomId: string) {
  const directions = ["north", "east", "south", "west"] as const;
  if (isResolving) return [...directions];
  return directions.filter(direction => !getConnectedRoomId(dungeonMap, roomId, direction) &&
    !(inventoryItem === "key" && getRoom(dungeonMap, roomId)?.[direction] === "locked"));
}
