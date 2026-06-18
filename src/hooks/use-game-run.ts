import * as Haptics from "expo-haptics";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type {
  GameEngineSystem,
  GameEngineUpdateEventOptionType,
} from "react-native-game-engine";

import type { RoomSceneActor } from "@/components/game-view-panel";
import {
  advanceAnimationFrame,
  COMBAT,
  createCombatAnimationFrame,
  PLAYER,
  type CombatAnimationFrame,
} from "@/entities";
import {
  addItemToRoom,
  hasRoomStairs as checkRoomStairs,
  createAndSaveSeededDungeonMap,
  createSeededDungeonMap,
  damageMonsterInRoom,
  getConnectedRoomId,
  getCurrentRoom,
  getCurrentRoomId,
  getGridPosition,
  getGuardedDirections,
  getLockedDirections,
  getRoom,
  getRoomItem,
  getRoomItemId,
  getRoomMonster,
  moveCurrentPosition,
  POSSIBLE_ITEMS,
  removeItemFromRoom,
  saveDungeonMap,
  unlockDoor,
  updateStoredDungeonMap,
  type Direction,
  type DungeonMap as DungeonMapType,
  type GridPosition,
  type ItemId,
  type WorldMonster,
} from "@/utils/dungeon-map";
import type { Difficulty } from "@/utils/settings-storage";

export const PLAYER_MAX_HEALTH = PLAYER.maxHealth;
export const PLAYER_MAX_ENERGY = PLAYER.maxEnergy;
export const TURN_DURATION = 4000;

type PlayerAction =
  | "attack"
  | "defend"
  | "descend"
  | "item"
  | "move-east"
  | "move-north"
  | "move-south"
  | "move-west"
  | "pickup-item"
  | "special";

const GAME_LOOP_TICK = 100;
const TURN_TIMEOUT_ACTION = "defend" satisfies PlayerAction;
const moveActionDirections = {
  "move-east": "east",
  "move-north": "north",
  "move-south": "south",
  "move-west": "west",
} satisfies Partial<Record<PlayerAction, Direction>>;

type UseGameRunOptions = {
  difficulty: Difficulty;
  onGameOver: (score: number) => void;
  seed: string;
  vibrationEnabled: boolean;
};

type GameLoopEntity = {
  elapsed: number;
  expired: boolean;
  isTurnClockActive: () => boolean;
  onExpire: () => void;
  onFrame: (delta: number, turnTimeRemaining?: number) => void;
  resetKey: number;
};

type GameLoopEntities = {
  gameLoop: GameLoopEntity;
};

export class GameLoopTimer {
  private currentTime = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private subscribers: ((time: number) => void)[] = [];

  start() {
    if (this.intervalId) {
      return;
    }

    this.intervalId = setInterval(() => {
      this.currentTime += GAME_LOOP_TICK;
      this.subscribers.forEach((subscriber) => subscriber(this.currentTime));
    }, GAME_LOOP_TICK);
  }

  stop() {
    if (!this.intervalId) {
      return;
    }

    clearInterval(this.intervalId);
    this.intervalId = null;
  }

  subscribe(callback: (time: number) => void) {
    if (!this.subscribers.includes(callback)) {
      this.subscribers.push(callback);
    }
  }

  unsubscribe(callback: (time: number) => void) {
    this.subscribers = this.subscribers.filter(
      (subscriber) => subscriber !== callback,
    );
  }
}

export const runGameLoop: GameEngineSystem = (
  entities: GameLoopEntities,
  { time }: GameEngineUpdateEventOptionType,
) => {
  const loop = entities.gameLoop;

  if (!loop) {
    return entities;
  }

  const delta = Math.max(0, time.delta || GAME_LOOP_TICK);
  let turnTimeRemaining: number | undefined;
  let didExpire = false;

  if (loop.isTurnClockActive() && !loop.expired) {
    loop.elapsed = Math.min(TURN_DURATION, loop.elapsed + delta);
    turnTimeRemaining = TURN_DURATION - loop.elapsed;

    if (loop.elapsed >= TURN_DURATION) {
      loop.expired = true;
      didExpire = true;
      turnTimeRemaining = 0;
    }
  }

  loop.onFrame(delta, turnTimeRemaining);

  if (didExpire) {
    loop.onExpire();
  }

  return entities;
};

function restartAnimations(
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

function createLevelMap(seed: string, level: number, startingPosition?: GridPosition) {
  return createSeededDungeonMap(seed, level, startingPosition);
}

function getItemLabel(itemId: ItemId | null) {
  return itemId
    ? (POSSIBLE_ITEMS.find((item) => item.id === itemId)?.label ?? itemId)
    : null;
}

function isMoveAction(
  action: PlayerAction,
): action is keyof typeof moveActionDirections {
  return action in moveActionDirections;
}

function getDisabledDirections({
  dungeonMap,
  isResolving,
  roomId,
}: {
  dungeonMap: DungeonMapType;
  isResolving: boolean;
  roomId: string;
}) {
  const directions: Direction[] = ["north", "east", "south", "west"];

  if (isResolving) {
    return directions;
  }

  return directions.filter(
    (direction) => !getConnectedRoomId(dungeonMap, roomId, direction),
  );
}

function canUseInventoryItem({
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

function resetRoomFeedback({
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

function getTurnStatus({
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

export function useGameRun({
  difficulty,
  onGameOver,
  seed,
  vibrationEnabled,
}: UseGameRunOptions) {
  const [level, setLevel] = useState(1);
  const [clearedLevels, setClearedLevels] = useState(0);
  const [dungeonMap, setDungeonMap] = useState(() => createLevelMap(seed, 1));
  const [inventoryItem, setInventoryItem] = useState<ItemId | null>(null);
  const timeoutIds = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearedLevelsRef = useRef(0);
  const nextLevelStartingPositionRef = useRef<GridPosition | null>(null);
  const [animationFrame, setAnimationFrame] =
    useState<CombatAnimationFrame>(createCombatAnimationFrame);
  const [enemyHealthLossAmount, setEnemyHealthLossAmount] = useState(0);
  const [isResolving, setIsResolving] = useState(false);
  const [playerEnergy, setPlayerEnergy] = useState(PLAYER_MAX_ENERGY);
  const [playerEnergyLossAmount, setPlayerEnergyLossAmount] = useState(0);
  const [playerHealth, setPlayerHealth] = useState(PLAYER_MAX_HEALTH);
  const [playerHealthLossAmount, setPlayerHealthLossAmount] = useState(0);
  const [turnNumber, setTurnNumber] = useState(0);
  const [turnTimeRemaining, setTurnTimeRemaining] = useState(TURN_DURATION);

  const currentRoom =
    getCurrentRoom(dungeonMap) ?? getRoom(dungeonMap, dungeonMap.startingRoomId);
  const currentRoomId = currentRoom?.id ?? getCurrentRoomId(dungeonMap);
  const currentRoomItem = getRoomItemId(dungeonMap, currentRoom);
  const currentRoomItemObject = getRoomItem(dungeonMap, currentRoom);
  const currentRoomItemSprite = currentRoomItemObject?.sprite ?? null;
  const currentMonster = getRoomMonster(dungeonMap, currentRoom);
  const currentMonsterId = currentMonster?.id ?? null;
  const hasLost = playerHealth <= 0;
  const hasTurnTimer = difficulty !== "easy";
  const roomHasStairs = currentRoom ? checkRoomStairs(currentRoom) : false;
  const roomSceneActors: RoomSceneActor[] = currentRoom
    ? (() => {
        const seenMonsterIds = new Set<string>();
        const seenItemIds = new Set<string>();
        const sceneActors: RoomSceneActor[] = [];

        currentRoom.contents.forEach((content) => {
          if (content.type === "monster") {
            const monster = dungeonMap.entities.monsters[content.id];

            if (!monster || monster.currentHealth <= 0 || seenMonsterIds.has(monster.id)) {
              return;
            }

            seenMonsterIds.add(monster.id);
            sceneActors.push({
              currentHealth: monster.currentHealth,
              emoji: monster.sprite,
              kind: "enemy",
              isActive: monster.id === currentMonsterId,
              label: monster.name,
              maxHealth: monster.maximumHealth,
            });
            return;
          }

          if (content.type === "item") {
            const item = dungeonMap.entities.items[content.id];

            if (!item || seenItemIds.has(item.id)) {
              return;
            }

            seenItemIds.add(item.id);
            sceneActors.push({
              emoji: item.sprite ?? item.label,
              kind: "item",
              label: item.label,
            });
            return;
          }

          if (content.type === "stairs") {
            sceneActors.push({
              emoji: "🪜",
              kind: "stairs",
              label: "Stairs",
            });
          }
        });

        getGuardedDirections(dungeonMap, currentRoom.id).forEach((direction) => {
          const guard = Object.values(dungeonMap.entities.doorwayGuards).find(
            (candidate) => candidate.roomId === currentRoom.id && candidate.direction === direction,
          );
          const monster = guard ? dungeonMap.entities.monsters[guard.monsterId] : null;

          if (!monster || monster.currentHealth <= 0 || seenMonsterIds.has(monster.id)) {
            return;
          }

          seenMonsterIds.add(monster.id);
          sceneActors.push({
            currentHealth: monster.currentHealth,
            emoji: monster.sprite,
            kind: "enemy",
            isActive: monster.id === currentMonsterId,
            label: monster.name,
            maxHealth: monster.maximumHealth,
          });
        });

        return sceneActors;
      })()
    : [];
  const currentEnemy = currentMonster
    ? {
        emoji: currentMonster.sprite,
        hitPoints: currentMonster.currentHealth,
        name: currentMonster.name,
      }
    : null;
  const currentEnemyMaxHitPoints = currentMonster?.maximumHealth ?? 1;
  const hasRoomEnemy = Boolean(currentMonster);
  const currentRoomItemLabel = getItemLabel(currentRoomItem);
  const inventoryItemLabel = getItemLabel(inventoryItem);
  const inventoryItemSprite = inventoryItem
    ? (POSSIBLE_ITEMS.find((item) => item.id === inventoryItem)?.sprite ?? null)
    : null;
  const isItemDisabled =
    isResolving ||
    hasLost ||
    !canUseInventoryItem({
      currentRoomId,
      dungeonMap,
      inventoryItem,
      monster: currentMonster,
      playerEnergy,
      playerHealth,
    });
  const disabledDirections = getDisabledDirections({
    dungeonMap,
    isResolving,
    roomId: currentRoomId,
  });
  const turnStatus = getTurnStatus({
    currentEnemyName: currentEnemy?.name,
    hasRoomEnemy,
    hasLost,
    isResolving,
    level,
    roomId: currentRoomId,
    clearedLevels,
  });

  useEffect(() => {
    const scheduledTimeoutIds = timeoutIds.current;

    return () => {
      scheduledTimeoutIds.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const startingPosition = nextLevelStartingPositionRef.current;
    nextLevelStartingPositionRef.current = null;

    void (async () => {
      const nextMap = await createAndSaveSeededDungeonMap(
        seed,
        level,
        startingPosition ?? undefined,
      );

      if (isMounted) {
        setDungeonMap(nextMap);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [level, seed]);

  const schedule = useCallback((delay: number, callback: () => void) => {
    const timeoutId = setTimeout(callback, delay);
    timeoutIds.current.push(timeoutId);
  }, []);

  const commitMap = useCallback(
    (updater: (map: DungeonMapType) => DungeonMapType) => {
      const nextMap = updater(dungeonMap);

      setDungeonMap(nextMap);
      void updateStoredDungeonMap(updater).then((storedMap) =>
        saveDungeonMap(storedMap ?? nextMap),
      );

      return nextMap;
    },
    [dungeonMap],
  );

  const triggerDamageHaptic = useCallback(() => {
    if (!vibrationEnabled) {
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [vibrationEnabled]);

  const advanceToNextLevel = useCallback(
    (startingPosition?: GridPosition) => {
      const nextClearedLevels = clearedLevelsRef.current + 1;
      const nextLevel = level + 1;
      const nextMap = createLevelMap(seed, nextLevel, startingPosition);

      nextLevelStartingPositionRef.current = startingPosition ?? null;
      clearedLevelsRef.current = nextClearedLevels;
      setClearedLevels(nextClearedLevels);
      setLevel(nextLevel);
      setDungeonMap(nextMap);
      void saveDungeonMap(nextMap);
      resetRoomFeedback({
        setEnemyHealthLossAmount,
        setPlayerEnergyLossAmount,
        setPlayerHealthLossAmount,
      });
      setPlayerHealth(PLAYER_MAX_HEALTH);
      setPlayerEnergy(PLAYER_MAX_ENERGY);
      setTurnTimeRemaining(TURN_DURATION);
      setTurnNumber((number) => number + 1);
    },
    [level, seed],
  );

  const finishTurn = useCallback(() => {
    setTurnTimeRemaining(TURN_DURATION);
    setIsResolving(false);
    setTurnNumber((number) => number + 1);
  }, []);

  const startEnemyMove = useCallback(
    (isDefending: boolean, monsterDamage: number) => {
      restartAnimations(setAnimationFrame, ["enemyAttackElapsed"]);

      if (!isDefending) {
        schedule(250, () => {
          setPlayerHealthLossAmount(monsterDamage);
          restartAnimations(setAnimationFrame, [
            "playerDamageElapsed",
            "playerHealthLossElapsed",
          ]);
          triggerDamageHaptic();
        });
      }

      schedule(500, () => {
        if (!isDefending) {
          setPlayerHealth((health) => {
            const nextHealth = Math.max(0, health - monsterDamage);

            if (nextHealth <= 0) {
              schedule(0, () => onGameOver(clearedLevelsRef.current));
            }

            return nextHealth;
          });
        }

        finishTurn();
      });
    },
    [finishTurn, onGameOver, schedule, triggerDamageHaptic],
  );

  const finishPlayerAction = useCallback(
    ({
      isDefending = false,
      mapAtEnd,
      startedRoomId,
    }: {
      isDefending?: boolean;
      mapAtEnd?: DungeonMapType;
      startedRoomId: string;
    }) => {
      const roomAtEnd = getCurrentRoom(mapAtEnd ?? dungeonMap);
        const monsterAtEnd = getRoomMonster(mapAtEnd ?? dungeonMap, roomAtEnd);

      if (roomAtEnd?.id === startedRoomId && monsterAtEnd) {
        setIsResolving(true);
        startEnemyMove(isDefending, monsterAtEnd.damage);
        return;
      }

      finishTurn();
    },
    [dungeonMap, finishTurn, startEnemyMove],
  );

  const resolveTurn = useCallback(
    (action: PlayerAction) => {
      if (isResolving || hasLost) {
        return;
      }

      if (!hasRoomEnemy) {
        if (action === TURN_TIMEOUT_ACTION) {
          finishTurn();
        }
        return;
      }

      if (action === "special" && playerEnergy <= 0) {
        return;
      }

      setTurnTimeRemaining(0);
      setIsResolving(true);

      if (action === "defend") {
        schedule(150, () =>
          finishPlayerAction({ isDefending: true, startedRoomId: currentRoomId }),
        );
        return;
      }

      if (!currentMonster) {
        finishTurn();
        return;
      }

      const damage = currentMonster.chases
        ? 0
        : action === "special"
          ? COMBAT.attackDamage * 2
          : COMBAT.attackDamage;
      const healthLost = Math.min(currentMonster.currentHealth, damage);

      if (action === "special") {
        setPlayerEnergyLossAmount(1);
        restartAnimations(setAnimationFrame, ["playerEnergyLossElapsed"]);
        setPlayerEnergy((energy) => Math.max(0, energy - 1));
      }

      restartAnimations(setAnimationFrame, ["playerAttackElapsed"]);

      schedule(250, () => {
        setEnemyHealthLossAmount(healthLost);
        restartAnimations(setAnimationFrame, [
          "enemyDamageElapsed",
          "enemyHealthLossElapsed",
        ]);
      });

      schedule(500, () => {
        const nextMap = commitMap((map) =>
          damageMonsterInRoom(map, currentRoomId, currentMonster.id, damage),
        );

        finishPlayerAction({
          mapAtEnd: nextMap,
          startedRoomId: currentRoomId,
        });
      });
    },
    [
      commitMap,
      currentMonster,
      finishPlayerAction,
      finishTurn,
      hasLost,
      hasRoomEnemy,
      isResolving,
      currentRoomId,
      playerEnergy,
      schedule,
    ],
  );

  const isTurnClockActive = useCallback(
    () => hasTurnTimer && !hasLost && !isResolving,
    [hasLost, hasTurnTimer, isResolving],
  );

  const isGameLoopRunning = useCallback(() => !hasLost, [hasLost]);

  const updateGameFrame = useCallback(
    (delta: number, nextTurnTimeRemaining?: number) => {
      setAnimationFrame((frame) => advanceAnimationFrame(frame, delta));

      if (typeof nextTurnTimeRemaining === "number") {
        setTurnTimeRemaining(Math.max(0, nextTurnTimeRemaining));
      }
    },
    [],
  );

  const expireTurn = useCallback(() => {
    setTurnTimeRemaining(0);
    resolveTurn(TURN_TIMEOUT_ACTION);
  }, [resolveTurn]);

  async function activateInventoryItem() {
    if (isItemDisabled || !inventoryItem) {
      return;
    }

    const startedRoomId = currentRoomId;

    if (inventoryItem === "health-potion") {
      setPlayerHealth((health) =>
        Math.min(PLAYER_MAX_HEALTH, health + PLAYER_MAX_HEALTH / 2),
      );
      setInventoryItem(null);
      finishPlayerAction({ startedRoomId });
      return;
    }

    if (inventoryItem === "energy-meal") {
      setPlayerEnergy((energy) =>
        Math.min(PLAYER_MAX_ENERGY, energy + PLAYER_MAX_ENERGY / 2),
      );
      setInventoryItem(null);
      finishPlayerAction({ startedRoomId });
      return;
    }

    if (inventoryItem === "key") {
      const lockedDirection = getLockedDirections(dungeonMap, currentRoomId)[0];

      if (!lockedDirection) {
        return;
      }

      const nextMap = commitMap((map) =>
        unlockDoor(map, currentRoomId, lockedDirection),
      );
      setInventoryItem(null);
      finishPlayerAction({ mapAtEnd: nextMap, startedRoomId });
      return;
    }

    if (currentMonster?.chases) {
      setInventoryItem(null);
      setEnemyHealthLossAmount(currentMonster.currentHealth);
      restartAnimations(setAnimationFrame, [
        "enemyDamageElapsed",
        "enemyHealthLossElapsed",
      ]);
      triggerDamageHaptic();
      const nextMap = commitMap((map) =>
        damageMonsterInRoom(
          map,
          currentRoomId,
          currentMonster.id,
          currentMonster.currentHealth,
        ),
      );
      finishPlayerAction({
        mapAtEnd: nextMap,
        startedRoomId,
      });
    }
  }

  async function pickupItem() {
    if (isResolving || hasLost || !currentRoomItem || !currentRoomItemObject) {
      return;
    }

    const nextInventoryItem = currentRoomItem;

    void commitMap((map) => {
      const mapWithoutPickedItem = removeItemFromRoom(
        map,
        currentRoomId,
        currentRoomItemObject.id,
      );

      return inventoryItem
        ? addItemToRoom(mapWithoutPickedItem, currentRoomId, inventoryItem)
        : mapWithoutPickedItem;
    });
    setInventoryItem(nextInventoryItem);
    finishPlayerAction({ startedRoomId: currentRoomId });
  }

  function playerAction(action: PlayerAction) {
    if (isResolving || hasLost) {
      return;
    }

    if (isMoveAction(action)) {
      moveToRoom(moveActionDirections[action]);
      return;
    }

    if (action === "descend") {
      advanceToNextLevel(nextLevelStartingPositionRef.current ?? undefined);
      return;
    }

    if (action === "item") {
      activateInventoryItem();
      return;
    }

    if (action === "pickup-item") {
      pickupItem();
      return;
    }

    if (!hasRoomEnemy) {
      return;
    }

    if (action === "special" && playerEnergy <= 0) {
      return;
    }

    resolveTurn(action);
  }

  async function moveToRoom(direction: Direction) {
    if (isResolving || hasLost) {
      return;
    }

    const nextRoomId = getConnectedRoomId(dungeonMap, currentRoomId, direction);

    if (!nextRoomId) {
      return;
    }

    const nextRoom = getRoom(dungeonMap, nextRoomId);

    if (checkRoomStairs(nextRoom)) {
      resetRoomFeedback({
        setEnemyHealthLossAmount,
        setPlayerEnergyLossAmount,
        setPlayerHealthLossAmount,
      });
      void commitMap((map) => moveCurrentPosition(map, nextRoomId));
      const stairPosition = getGridPosition(nextRoomId);
      nextLevelStartingPositionRef.current = stairPosition;
      finishTurn();
      return;
    }

    resetRoomFeedback({
      setEnemyHealthLossAmount,
      setPlayerEnergyLossAmount,
      setPlayerHealthLossAmount,
    });
    void commitMap((map) => moveCurrentPosition(map, nextRoomId));
    finishTurn();
  }

  return {
    animationFrame,
    currentEnemy,
    currentEnemyMaxHitPoints,
    currentRoomItem,
    currentRoomItemLabel,
    currentRoomItemSprite,
    currentRoomId,
    roomSceneActors,
    disabledDirections,
    dungeonMap,
    enemyHealthLossAmount,
    hasLost,
    hasRoomEnemy,
    roomHasStairs,
    hasTurnTimer,
    inventoryItem,
    inventoryItemLabel,
    inventoryItemSprite,
    isItemDisabled,
    isResolving,
    level,
    playerEnergy,
    playerEnergyLossAmount,
    playerHealth,
    playerHealthLossAmount,
    playerAction,
    expireTurn,
    isGameLoopRunning,
    isTurnClockActive,
    turnStatus,
    turnNumber,
    turnTimeRemaining,
    updateGameFrame,
  };
}