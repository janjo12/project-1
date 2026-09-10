import { type Dispatch, type SetStateAction } from "react";

import type { RoomDoorways, RoomSceneActor, ScenePosition } from "@/components/game-view-panel";
import { PLAYER, type CombatAnimationFrame } from "@/entities";
import { GAME_PARAMETERS } from "@/gameparameters";
import {
  getHardTurnLimit,
  getTurnDuration,
  hasTurnLimit,
  hasTurnTimer as checkTurnTimer,
} from "@/hooks/run-game-policies";
import { createSeededDungeonMap } from "@/utils/dungeon-generation";
import {
  getDoorwayGuardPlacements,
  POSSIBLE_ITEMS,
  type Direction,
  type DungeonMap as DungeonMapType,
  type GridPosition,
  type ItemId,
  type WorldMonster,
} from "@/utils/dungeon-map";
import {
  addItemToRoom,
  getConnectedRoomId,
  getCurrentRoom,
  getCurrentRoomId,
  getGuardedDirections,
  getLockedDirections,
  getRoom,
  getRoomItem,
  getRoomItemId,
  getRoomMonster,
  getTargetableRoomMonsterRefs,
  hasRoomStairs as checkRoomStairs,
  removeItemFromRoom,
} from "@/utils/dungeon-map-runtime";
import type { Difficulty } from "@/utils/settings-storage";

//#region constants and types
export const PLAYER_MAX_HEALTH = PLAYER.maxHealth;
export const PLAYER_MAX_ENERGY = PLAYER.maxEnergy;

export const directionScenePositions = {
  east: "right",
  north: "top",
  south: "bottom",
  west: "left",
} satisfies Record<Direction, ScenePosition>;

export const defaultRoomDoorways: RoomDoorways = {
  bottom: "wall",
  left: "wall",
  right: "wall",
  top: "wall",
};

export const playerEntryPositions = {
  east: "left",
  north: "bottom",
  south: "top",
  west: "right",
} satisfies Record<Direction, ScenePosition>;

export type UseGameRunOptions = {
  difficulty: Difficulty;
  onGameOver: (score: number) => void;
  seed: string;
  vibrationEnabled: boolean;
};

//#endregion

//#region helper functions
export function restartAnimations(
  setFrame: Dispatch<SetStateAction<CombatAnimationFrame>>,
  animationKeys: (keyof Omit<CombatAnimationFrame, "bounceElapsed">)[],
) {
  setFrame((frame) => {
    const nextFrame = { ...frame };

    animationKeys.forEach((animationKey) => {
      nextFrame[animationKey] = 0;
    });

    return nextFrame;
  });
}

export function createLevelMap(seed: string, level: number, startingPosition?: GridPosition, includeClock = false) {
  return createSeededDungeonMap(seed, level, startingPosition, includeClock);
}

export function getItemLabel(itemId: ItemId | null) {
  return itemId
    ? (POSSIBLE_ITEMS.find((item) => item.id === itemId)?.label ?? itemId)
    : null;
}

export function getDisabledDirections({
  dungeonMap,
  inventoryItem,
  isResolving,
  roomId,
}: {
  dungeonMap: DungeonMapType;
  inventoryItem: ItemId | null;
  isResolving: boolean;
  roomId: string;
}) {
  const directions: Direction[] = ["north", "east", "south", "west"];

  if (isResolving) {
    return directions;
  }

  return directions.filter(
    (direction) =>
      !getConnectedRoomId(dungeonMap, roomId, direction) &&
      !(inventoryItem === "key" && getRoom(dungeonMap, roomId)?.[direction] === "locked"),
  );
}

export function getInventoryItemActivationDescription(itemId: ItemId | null) {
  const descriptions: Record<string, string> = {
    clock: "Activates before a turn-limit game over and adds 5 + current level turns.",
    "energy-meal": "Activates when your energy reaches zero.",
    "health-potion": "Activates before you die when your health reaches zero.",
    key: "Activates when you try to open a locked door.",
    "silver-bullet": "Activates when you attack a werewolf, replacing your attack skill.",
  };

  return itemId ? descriptions[itemId] ?? "Activates automatically when needed." : null;
}

export function resolveHealthLoss(health: number, damage: number, item: ItemId | null) {
  const remainingHealth = Math.max(0, health - damage);
  const usesPotion = remainingHealth === 0 && item === "health-potion";

  return { nextHealth: usesPotion ? recoverStat(remainingHealth, PLAYER_MAX_HEALTH) : remainingHealth, usesPotion };
}

export function resolveEnergyLoss(energy: number, cost: number, item: ItemId | null) {
  const remainingEnergy = Math.max(0, energy - cost);
  const usesMeal = remainingEnergy === 0 && item === "energy-meal";

  return { nextEnergy: usesMeal ? recoverStat(remainingEnergy, PLAYER_MAX_ENERGY) : remainingEnergy, usesMeal };
}

export function resolveTurnLoss(counter: number, item: ItemId | null, level: number) {
  const remainingTurns = Math.max(0, counter - 1);
  const usesClock = remainingTurns === 0 && item === "clock";

  return { nextCounter: usesClock ? GAME_PARAMETERS.turn.clockBaseTurns + level : remainingTurns, usesClock };
}

export function canUseInventoryItem({
  currentRoomId,
  dungeonMap,
  inventoryItem,
  monster,
  playerEnergy,
  playerHealth,
}: {
  currentRoomId: string;
  dungeonMap: DungeonMapType;
  inventoryItem: ItemId | null;
  monster: WorldMonster | null;
  playerEnergy: number;
  playerHealth: number;
}) {
  if (!inventoryItem) {
    return false;
  }

  if (inventoryItem === "health-potion") {
    return playerHealth < PLAYER_MAX_HEALTH;
  }

  if (inventoryItem === "energy-meal") {
    return playerEnergy < PLAYER_MAX_ENERGY;
  }

  if (inventoryItem === "key") {
    return getLockedDirections(dungeonMap, currentRoomId).length > 0;
  }

  return Boolean(monster?.chases);
}

export function resetRoomFeedback({
  setEnemyHealthLossAmount,
  setPlayerEnergyLossAmount,
  setPlayerHealthLossAmount,
}: {
  setEnemyHealthLossAmount: Dispatch<SetStateAction<number>>;
  setPlayerEnergyLossAmount: Dispatch<SetStateAction<number>>;
  setPlayerHealthLossAmount: Dispatch<SetStateAction<number>>;
}) {
  setEnemyHealthLossAmount(0);
  setPlayerEnergyLossAmount(0);
  setPlayerHealthLossAmount(0);
}

export function getTurnStatus({
  currentEnemyName,
  clearedLevels,
  hasRoomEnemy,
  hasLost,
  isResolving,
  level,
  roomId,
}: {
  currentEnemyName?: string;
  clearedLevels: number;
  hasRoomEnemy: boolean;
  hasLost: boolean;
  isResolving: boolean;
  level: number;
  roomId: string;
}) {
  if (hasLost) {
    return "You fell!";
  }

  if (isResolving) {
    return "Resolving turn...";
  }

  if (!hasRoomEnemy) {
    return `Room ${roomId} clear | Level ${level} | Cleared ${clearedLevels}`;
  }

  return `Facing ${currentEnemyName ?? "enemy"} | Level ${level} | Room ${roomId}`;
}

export function getRoomDoorways(room: ReturnType<typeof getCurrentRoom>): RoomDoorways {
  if (!room) {
    return defaultRoomDoorways;
  }

  return {
    bottom: room.south,
    left: room.west,
    right: room.east,
    top: room.north,
  };
}

export function createMonsterSceneActor({
  isActive,
  monster,
  position,
}: {
  isActive: boolean;
  monster: WorldMonster;
  position: ScenePosition;
}): RoomSceneActor {
  return {
    id: monster.id,
    currentHealth: monster.currentHealth,
    sprite: monster.sprite,
    kind: "enemy",
    isActive,
    label: monster.name,
    maxHealth: monster.maximumHealth,
    position,
  };
}

export function getRoomSceneActors({
  currentMonsterId,
  dungeonMap,
  room,
}: {
  currentMonsterId: string | null;
  dungeonMap: DungeonMapType;
  room: ReturnType<typeof getCurrentRoom>;
}) {
  if (!room) {
    return [];
  }

  const seenMonsterIds = new Set<string>();
  const seenItemIds = new Set<string>();
  const sceneActors: RoomSceneActor[] = [];

  getTargetableRoomMonsterRefs(dungeonMap, room).forEach((content) => {
    const monster = dungeonMap.entities.monsters[content.id];

    if (!monster || seenMonsterIds.has(monster.id)) {
      return;
    }

    seenMonsterIds.add(monster.id);
    sceneActors.push(
      createMonsterSceneActor({
        isActive: monster.id === currentMonsterId,
        monster,
        position: "center",
      }),
    );
  });

  room.contents.forEach((content) => {
    if (content.type === "item") {
      const item = dungeonMap.entities.items[content.id];

      if (!item || seenItemIds.has(item.id)) {
        return;
      }

      seenItemIds.add(item.id);
      sceneActors.push({
        id: item.id,
        sprite: item.sprite ?? item.label,
        kind: "item",
        label: item.label,
        position: "center",
      });
      return;
    }

    if (content.type === "stairs") {
      sceneActors.push({
        id: "stairs",
        sprite: "\uD83E\uDE9C",
        kind: "stairs",
        label: "Stairs",
        position: "center",
      });
    }
  });

  getGuardedDirections(dungeonMap, room.id).flatMap((direction) =>
    getDoorwayGuardPlacements(dungeonMap, room.id, direction).map((guard) => ({ direction, guard })),
  ).forEach(({ direction, guard }) => {
    const monster = guard ? dungeonMap.entities.monsters[guard.monsterId] : null;

    if (!monster || monster.currentHealth <= 0 || seenMonsterIds.has(monster.id)) {
      return;
    }

    seenMonsterIds.add(monster.id);
    sceneActors.push(
      createMonsterSceneActor({
        isActive: monster.id === currentMonsterId,
        monster,
        position: directionScenePositions[direction],
      }),
    );
  });

  return sceneActors.sort(
    (leftActor, rightActor) =>
      Number(Boolean(leftActor.isActive)) - Number(Boolean(rightActor.isActive)),
  );
}

type RunSnapshotOptions = {
  activeMonsterId: string | null;
  clearedLevels: number;
  difficulty: Difficulty;
  dungeonMap: DungeonMapType;
  inventoryItem: ItemId | null;
  isResolving: boolean;
  level: number;
  playerEnergy: number;
  playerHealth: number;
  turnCounter: number;
};

export function getInventoryItemSprite(itemId: ItemId | null) {
  return itemId
    ? (POSSIBLE_ITEMS.find((item) => item.id === itemId)?.sprite ?? null)
    : null;
}

export function getCurrentEnemy(monster: WorldMonster | null) {
  return monster
    ? {
        sprite: monster.sprite,
        hitPoints: monster.currentHealth,
        name: monster.name,
      }
    : null;
}

export function getRunSnapshot({
  activeMonsterId,
  clearedLevels,
  difficulty,
  dungeonMap,
  inventoryItem,
  isResolving,
  level,
  playerEnergy,
  playerHealth,
  turnCounter,
}: RunSnapshotOptions) {
  const currentRoom =
    getCurrentRoom(dungeonMap) ?? getRoom(dungeonMap, dungeonMap.startingRoomId);
  const currentRoomId = currentRoom?.id ?? getCurrentRoomId(dungeonMap);
  const currentRoomItem = getRoomItemId(dungeonMap, currentRoom);
  const currentRoomItemObject = getRoomItem(dungeonMap, currentRoom);
  const currentMonster = getRoomMonster(dungeonMap, currentRoom);
  const currentMonsterId = currentMonster?.id ?? null;
  const hasHardTurnCounter = hasTurnLimit(difficulty);
  const hasLost = playerHealth <= 0 || (hasHardTurnCounter && turnCounter <= 0);
  const hasTurnTimer = checkTurnTimer(difficulty);
  const currentEnemy = getCurrentEnemy(currentMonster);
  const hasRoomEnemy = Boolean(currentMonster);

  return {
    currentEnemy,
    currentEnemyMaxHitPoints: currentMonster?.maximumHealth ?? 1,
    currentMonster,
    currentRoom,
    currentRoomId,
    currentRoomItem,
    currentRoomItemLabel: getItemLabel(currentRoomItem),
    currentRoomItemObject,
    currentRoomItemSprite: currentRoomItemObject?.sprite ?? null,
    disabledDirections: getDisabledDirections({
      dungeonMap,
      inventoryItem,
      isResolving,
      roomId: currentRoomId,
    }),
    hasHardTurnCounter,
    hasLost,
    hasRoomEnemy,
    hasTurnTimer,
    inventoryItemLabel: getItemLabel(inventoryItem),
    inventoryItemActivationDescription: getInventoryItemActivationDescription(inventoryItem),
    inventoryItemSprite: getInventoryItemSprite(inventoryItem),
    isItemDisabled:
      isResolving ||
      hasLost ||
      !canUseInventoryItem({
        currentRoomId,
        dungeonMap,
        inventoryItem,
        monster: currentMonster,
        playerEnergy,
        playerHealth,
      }),
    roomDoorways: getRoomDoorways(currentRoom),
    roomHasStairs: currentRoom ? checkRoomStairs(currentRoom) : false,
    roomSceneActors: getRoomSceneActors({
      currentMonsterId: activeMonsterId ?? currentMonsterId,
      dungeonMap,
      room: currentRoom,
    }),
    turnDuration: getTurnDuration({ difficulty, level }),
    turnStatus: getTurnStatus({
      currentEnemyName: currentEnemy?.name,
      hasRoomEnemy,
      hasLost,
      isResolving,
      level,
      roomId: currentRoomId,
      clearedLevels,
    }),
  };
}

export function getPlayerAttackDamage(monster: WorldMonster, hasEnergy: boolean) {
  if (monster.chases) {
    return GAME_PARAMETERS.combat.werewolfMeleeDamage;
  }

  return hasEnergy
    ? GAME_PARAMETERS.combat.strongAttackDamage
    : GAME_PARAMETERS.combat.normalAttackDamage;
}

export function getNextLevelState({
  clearedLevels,
  difficulty,
  level,
  seed,
  startingPosition,
}: {
  clearedLevels: number;
  difficulty: Difficulty;
  level: number;
  seed: string;
  startingPosition?: GridPosition;
}) {
  const nextClearedLevels = clearedLevels + 1;
  const nextLevel = level + 1;
  const nextMap = createLevelMap(seed, nextLevel, startingPosition, difficulty !== "easy");

  return {
    nextClearedLevels,
    nextLevel,
    nextMap,
    nextTurnCounter: getHardTurnLimit({
      difficulty,
      map: nextMap,
    }),
    nextTurnDuration: getTurnDuration({ difficulty, level: nextLevel }),
  };
}

export function recoverStat(current: number, maximum: number) {
  return Math.min(
    maximum,
    current + maximum * GAME_PARAMETERS.player.itemRecoveryFraction,
  );
}

export function swapRoomItemWithInventory({
  currentRoomId,
  currentRoomItemId,
  dungeonMap,
  inventoryItem,
}: {
  currentRoomId: string;
  currentRoomItemId: ItemId;
  dungeonMap: DungeonMapType;
  inventoryItem: ItemId | null;
}) {
  const mapWithoutPickedItem = removeItemFromRoom(
    dungeonMap,
    currentRoomId,
    currentRoomItemId,
  );

  return inventoryItem
    ? addItemToRoom(mapWithoutPickedItem, currentRoomId, inventoryItem)
    : mapWithoutPickedItem;
}

//#endregion
