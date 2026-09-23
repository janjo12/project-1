import { createSceneFrameStore } from "@/utils/scene-frame-store";
//#region imports
import * as Haptics from "expo-haptics";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type { ScenePosition } from "@/components/game-view-panel";
import {
  advanceAnimationFrame,
} from "@/entities";
import {
  createLevelMap,
  getNextLevelState,
  getPlayerAttackDamage,
  getRunSnapshot,
  PLAYER_MAX_ENERGY,
  PLAYER_MAX_HEALTH,
  playerEntryPositions,
  resolveEnergyLoss,
  resolveHealthLoss,
  resolveTurnLoss,
  resetRoomFeedback,
  restartAnimations,
  swapRoomItemWithInventory,
  type UseGameRunOptions,
} from "@/hooks/run-game-helpers";
import {
  applyWerewolfChaseAfterAction,
  getEnemyAttackOutcome,
  getHardTurnLimit,
  getTurnDuration,
  hasTurnLimit,
} from "@/hooks/run-game-policies";
import {
  getGridPosition,
  type Direction,
  type DungeonMap as DungeonMapType,
  type GridPosition,
  type ItemId,
  type WorldMonster,
} from "@/utils/dungeon-map";
import {
  damageMonsterInRoom,
  getConnectedRoomId,
  getCurrentRoom,
  getRoom,
  getRoomMonster,
  getTargetableRoomMonsterRefs,
  hasRoomStairs as checkRoomStairs,
  moveCurrentPosition,
  unlockDoor,
} from "@/utils/dungeon-map-runtime";
import {
  createAndSaveSeededDungeonMap,
  saveDungeonMap,
  updateStoredDungeonMap,
} from "@/utils/dungeon-map-storage";
import { GAME_PARAMETERS } from "@/gameparameters";
export { GameLoopTimer, runGameLoop } from "@/hooks/run-game-loop";
export {
  applyWerewolfChaseAfterAction,
  getEnemyAttackOutcome,
  getHardTurnLimit,
  getTurnDuration,
  hasTurnLimit,
  hasTurnTimer,
  HARD_TURN_LIMIT,
  TURN_DURATION,
} from "@/hooks/run-game-policies";

//#endregion

export { PLAYER_MAX_ENERGY, PLAYER_MAX_HEALTH } from "@/hooks/run-game-helpers";

export function useRunGame({
  difficulty,
  onGameOver,
  seed,
  vibrationEnabled,
}: UseGameRunOptions) {
  //#region state and refs
  const [level, setLevel] = useState(1);
  const [clearedLevels, setClearedLevels] = useState(0);
  const [dungeonMap, setDungeonMap] = useState(() =>
    createLevelMap(seed, 1, undefined, difficulty !== "easy"),
  );
  const [inventoryItem, setInventoryItemState] = useState<ItemId | null>(null);
  const inventoryItemRef = useRef<ItemId | null>(null);
  const setInventoryItem = useCallback((item: ItemId | null) => {
    inventoryItemRef.current = item;
    setInventoryItemState(item);
  }, []);
  const timeoutIds = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearedLevelsRef = useRef(0);
  const hardTurnGameOverScheduledRef = useRef(false);
  const werewolfHasBeenEncounteredRef = useRef(false);
  const nextLevelStartingPositionRef = useRef<GridPosition | null>(null);
  const [sceneFrameStore] = useState(createSceneFrameStore);
  const setAnimationFrame = sceneFrameStore.setFrame;
  const [enemyHealthLossAmount, setEnemyHealthLossAmount] = useState(0);
  const [activeMonsterId, setActiveMonsterId] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [isCharged, setIsCharged] = useState(false);
  const chargedRef = useRef(false);
  const preserveTurnRef = useRef(false);
  const [playerEnergy, setPlayerEnergy] = useState(PLAYER_MAX_ENERGY);
  const [playerEnergyLossAmount, setPlayerEnergyLossAmount] = useState(0);
  const [playerHealth, setPlayerHealth] = useState(PLAYER_MAX_HEALTH);
  const [playerHealthLossAmount, setPlayerHealthLossAmount] = useState(0);
  const [playerScenePosition, setPlayerScenePosition] =
    useState<ScenePosition>("center");
  const [turnCounter, setTurnCounter] = useState(() =>
    getHardTurnLimit({
      difficulty,
      map: dungeonMap,
    }),
  );
  const [turnNumber, setTurnNumber] = useState(0);
  const [turnTimeRemaining, setTurnTimeRemaining] = useState(() =>
    getTurnDuration({ difficulty, level: 1 }),
  );

  const {
    currentEnemy,
    currentEnemyMaxHitPoints,
    currentMonster,
    currentRoomId,
    currentRoomItem,
    currentRoomItemLabel,
    currentRoomItemObject,
    currentRoomItemSprite,
    disabledDirections,
    hasHardTurnCounter,
    hasLost,
    hasRoomEnemy,
    hasTurnTimer,
    inventoryItemLabel,
    inventoryItemActivationDescription,
    inventoryItemSprite,
    roomDoorways,
    roomHasStairs,
    roomSceneActors,
    turnDuration,
    turnStatus,
  } = getRunSnapshot({
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
  });
  //#endregion

  //#region effects and callbacks
  useEffect(() => {
    const scheduledTimeoutIds = timeoutIds.current;

    return () => {
      scheduledTimeoutIds.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (currentMonster?.chases) {
      werewolfHasBeenEncounteredRef.current = true;
    }
  }, [currentMonster]);

  useEffect(() => {
    let isMounted = true;
    const startingPosition = nextLevelStartingPositionRef.current;
    nextLevelStartingPositionRef.current = null;

    void (async () => {
      const nextMap = await createAndSaveSeededDungeonMap(
        seed,
        level,
        startingPosition ?? undefined,
        difficulty !== "easy",
      );

      if (isMounted) {
        werewolfHasBeenEncounteredRef.current = false;
        setDungeonMap(nextMap);
        setTurnCounter(
          getHardTurnLimit({
            difficulty,
            map: nextMap,
          }),
        );
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [difficulty, level, seed]);

  const schedule = useCallback((delay: number, callback: () => void) => {
    const timeoutId = setTimeout(callback, delay);
    timeoutIds.current.push(timeoutId);
  }, []);

  const commitMap = useCallback(
    (
      updater: (map: DungeonMapType) => DungeonMapType,
      baseMap: DungeonMapType = dungeonMap,
    ) => {
      const nextMap = updater(baseMap);

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

  const resetFeedback = useCallback(() => {
    resetRoomFeedback({
      setEnemyHealthLossAmount,
      setPlayerEnergyLossAmount,
      setPlayerHealthLossAmount,
    });
  }, []);

  const advanceToNextLevel = useCallback(
    (startingPosition?: GridPosition) => {
      const {
        nextClearedLevels,
        nextLevel,
        nextMap,
        nextTurnCounter,
        nextTurnDuration,
      } = getNextLevelState({
        clearedLevels: clearedLevelsRef.current,
        difficulty,
        level,
        seed,
        startingPosition,
      });

      nextLevelStartingPositionRef.current = startingPosition ?? null;
      clearedLevelsRef.current = nextClearedLevels;
      setClearedLevels(nextClearedLevels);
      setLevel(nextLevel);
      setDungeonMap(nextMap);
      void saveDungeonMap(nextMap);
      resetFeedback();
      setPlayerHealth(PLAYER_MAX_HEALTH);
      setPlayerEnergy(PLAYER_MAX_ENERGY);
      chargedRef.current = false;
      setIsCharged(false);
      setPlayerScenePosition("center");
      setTurnCounter(nextTurnCounter);
      hardTurnGameOverScheduledRef.current = false;
      werewolfHasBeenEncounteredRef.current = false;
      setTurnTimeRemaining(nextTurnDuration);
      setTurnNumber((number) => number + 1);
    },
    [difficulty, level, resetFeedback, seed],
  );

  const finishTurn = useCallback(() => {
    setActiveMonsterId(null);
    setTurnTimeRemaining(turnDuration);
    setIsResolving(false);
    setTurnNumber((number) => number + 1);

    if (chargedRef.current && playerEnergy === 0 && inventoryItemRef.current === "energy-meal") {
      setPlayerEnergy(resolveEnergyLoss(0, 0, inventoryItemRef.current).nextEnergy);
      setInventoryItem(null);
    }
    const preservesTurn = preserveTurnRef.current;
    preserveTurnRef.current = false;
    chargedRef.current = false;
    setIsCharged(false);

    if (hasTurnLimit(difficulty) && !preservesTurn) {
      setTurnCounter((counter) => {
        const { nextCounter, usesClock } = resolveTurnLoss(counter, inventoryItem, level);

        if (usesClock) {
          setInventoryItem(null);
          hardTurnGameOverScheduledRef.current = false;
        }

        if (nextCounter <= 0 && !usesClock && !hardTurnGameOverScheduledRef.current) {
          hardTurnGameOverScheduledRef.current = true;
          schedule(0, () => onGameOver(clearedLevelsRef.current));
        }

        return nextCounter;
      });
    }
  }, [difficulty, inventoryItem, level, onGameOver, playerEnergy, schedule, setInventoryItem, turnDuration]);

  const finishNonMoveTurn = useCallback(
    ({
      mapAtEnd,
      roomId,
    }: {
      mapAtEnd?: DungeonMapType;
      roomId: string;
    }) => {
      if (werewolfHasBeenEncounteredRef.current) {
        commitMap(
          (map) =>
            applyWerewolfChaseAfterAction({
              hasEncounteredWerewolf: true,
              map,
              roomId,
            }),
          mapAtEnd,
        );
      }

      finishTurn();
    },
    [commitMap, finishTurn],
  );

  const startEnemyMove = useCallback(
    ({
      isDefending,
      mapAtEnd,
      monsterDamage,
      monsterId,
      roomId,
    }: {
      isDefending: boolean;
      mapAtEnd?: DungeonMapType;
      monsterDamage: number;
      monsterId: string;
      roomId: string;
    }) => {
      restartAnimations(setAnimationFrame, ["enemyAttackElapsed"]);

      const outcome = getEnemyAttackOutcome({
        isDefending,
        monsterDamage,
      });

      const counterattackDamage = isDefending && chargedRef.current
        ? GAME_PARAMETERS.combat.chargedCounterattackDamage : outcome.counterattackDamage;
      const damageTaken = isDefending && chargedRef.current ? 0 : outcome.damageTaken;

      schedule(GAME_PARAMETERS.animation.attackImpactDelayMs, () => {
          setPlayerHealthLossAmount(damageTaken);
          restartAnimations(setAnimationFrame, [
            "playerDamageElapsed",
            "playerHealthLossElapsed",
          ]);
          triggerDamageHaptic();

          if (isDefending) {
            setEnemyHealthLossAmount(
              counterattackDamage,
            );
            restartAnimations(setAnimationFrame, [
              "playerAttackElapsed",
              "enemyDamageElapsed",
              "enemyHealthLossElapsed",
            ]);
          }
        });

      schedule(GAME_PARAMETERS.animation.enemyTurnDurationMs, () => {
        let finalMap = mapAtEnd;

        if (isDefending) {
          finalMap = commitMap(
            (map) =>
              damageMonsterInRoom(
                map,
                roomId,
                monsterId,
                counterattackDamage,
              ),
            mapAtEnd,
          );
        }

          setPlayerHealth((health) => {
            const { nextHealth, usesPotion } = resolveHealthLoss(
              health,
              damageTaken,
              inventoryItem,
            );

            if (usesPotion) {
              setInventoryItem(null);
            }

            if (nextHealth <= 0 && !usesPotion) {
              schedule(0, () => onGameOver(clearedLevelsRef.current));
            }

            return nextHealth;
          });

        finishNonMoveTurn({ mapAtEnd: finalMap, roomId });
      });
    },
    [commitMap, finishNonMoveTurn, inventoryItem, onGameOver, schedule, setInventoryItem, triggerDamageHaptic, setAnimationFrame],
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
        setActiveMonsterId(monsterAtEnd.id);
        setIsResolving(true);
        startEnemyMove({
          isDefending,
          mapAtEnd,
          monsterDamage: monsterAtEnd.damage,
          monsterId: monsterAtEnd.id,
          roomId: startedRoomId,
        });
        return;
      }

      finishNonMoveTurn({ mapAtEnd, roomId: startedRoomId });
    },
    [dungeonMap, finishNonMoveTurn, startEnemyMove],
  );

  const toggleCharge = useCallback(() => {
    if (isResolving || hasLost) return;
    const cost = GAME_PARAMETERS.combat.chargeEnergyCost;
    if (chargedRef.current) {
      chargedRef.current = false;
      setIsCharged(false);
      setPlayerEnergy((energy) => Math.min(PLAYER_MAX_ENERGY, energy + cost));
      setPlayerEnergyLossAmount(0);
    } else if (playerEnergy >= cost) {
      chargedRef.current = true;
      setIsCharged(true);
      setPlayerEnergy((energy) => energy - cost);
      setPlayerEnergyLossAmount(cost);
      restartAnimations(setAnimationFrame, ["playerEnergyLossElapsed"]);
    }
  }, [hasLost, isResolving, playerEnergy, setAnimationFrame]);

  const animatePlayerAttack = useCallback((healthLost: number) => {
    restartAnimations(setAnimationFrame, ["playerAttackElapsed"]);

    schedule(GAME_PARAMETERS.animation.attackImpactDelayMs, () => {
      setEnemyHealthLossAmount(healthLost);
      restartAnimations(setAnimationFrame, [
        "enemyDamageElapsed",
        "enemyHealthLossElapsed",
      ]);
    });
  }, [schedule, setAnimationFrame]);

  const commitPlayerAttack = useCallback((monster: WorldMonster, damage: number) => {
    schedule(GAME_PARAMETERS.animation.attackDurationMs, () => {
      const nextMap = commitMap((map) =>
        damageMonsterInRoom(map, currentRoomId, monster.id, damage),
      );

      finishPlayerAction({
        mapAtEnd: nextMap,
        startedRoomId: currentRoomId,
      });
    });
  }, [commitMap, currentRoomId, finishPlayerAction, schedule]);

  const defend = useCallback(
    () => {
      if (isResolving || hasLost) {
        return;
      }

      if (!hasRoomEnemy) {
        preserveTurnRef.current = chargedRef.current;
        finishNonMoveTurn({ roomId: currentRoomId });
        return;
      }

      setTurnTimeRemaining(0);
      setIsResolving(true);

        schedule(GAME_PARAMETERS.animation.defendWindupMs, () =>
          finishPlayerAction({ isDefending: true, startedRoomId: currentRoomId }),
        );
    },
    [
      finishPlayerAction,
      finishNonMoveTurn,
      hasLost,
      hasRoomEnemy,
      isResolving,
      currentRoomId,
      schedule,
    ],
  );

  const attackMonster = useCallback(
    (monsterId: string) => {
      if (isResolving || hasLost) {
        return;
      }

      const room = getCurrentRoom(dungeonMap);
      const isTargetable = getTargetableRoomMonsterRefs(dungeonMap, room).some(
        (reference) => reference.id === monsterId,
      );
      const monster = dungeonMap.entities.monsters[monsterId];

      if (!isTargetable || !monster || monster.currentHealth <= 0) {
        return;
      }

      const usesSilverBullet = monster.chases && inventoryItem === "silver-bullet";
      const hasEnergy = chargedRef.current;
      const damage = usesSilverBullet
        ? monster.currentHealth
        : getPlayerAttackDamage(monster, hasEnergy);
      const healthLost = Math.min(monster.currentHealth, damage);

      setTurnTimeRemaining(0);
      setIsResolving(true);
      setActiveMonsterId(monsterId);

      if (usesSilverBullet) {
        setInventoryItem(null);
      }

      animatePlayerAttack(healthLost);
      commitPlayerAttack(monster, damage);
    },
    [
      animatePlayerAttack,
      commitPlayerAttack,
      dungeonMap,
      hasLost,
      isResolving,
      inventoryItem,
      setInventoryItem,
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
        setTurnTimeRemaining(Math.ceil(Math.max(0, nextTurnTimeRemaining) / 100) * 100);
      }
    },
    [setAnimationFrame],
  );

  const expireTurn = useCallback(() => {
    setTurnTimeRemaining(0);
    defend();
  }, [defend]);

  //#endregion

  //#region non-callback functions
  async function pickupItem() {
    if (isResolving || hasLost || !currentRoomItem || !currentRoomItemObject) {
      return;
    }

    preserveTurnRef.current = chargedRef.current;
    const nextInventoryItem = currentRoomItem;

    const nextMap = commitMap((map) =>
      swapRoomItemWithInventory({
        currentRoomId,
        currentRoomItemId: currentRoomItemObject.id,
        dungeonMap: map,
        inventoryItem,
      }),
    );
    setInventoryItem(nextInventoryItem);
    finishPlayerAction({ mapAtEnd: nextMap, startedRoomId: currentRoomId });
  }

  async function moveToRoom(direction: Direction) {
    if (isResolving || hasLost) {
      return;
    }

    const opensLockedDoor =
      inventoryItem === "key" &&
      getRoom(dungeonMap, currentRoomId)?.[direction] === "locked";
    const mapWithOpenDoor = opensLockedDoor
      ? unlockDoor(dungeonMap, currentRoomId, direction)
      : dungeonMap;
    const nextRoomId = getConnectedRoomId(mapWithOpenDoor, currentRoomId, direction);

    if (!nextRoomId) {
      return;
    }

    preserveTurnRef.current = chargedRef.current;
    const nextRoom = getRoom(dungeonMap, nextRoomId);

    resetFeedback();
    commitMap((map) => {
      const unlockedMap = opensLockedDoor
        ? unlockDoor(map, currentRoomId, direction)
        : map;
      return moveCurrentPosition(unlockedMap, nextRoomId);
    });
    if (opensLockedDoor) {
      setInventoryItem(null);
    }
    setPlayerScenePosition(playerEntryPositions[direction]);

    if (checkRoomStairs(nextRoom)) {
      nextLevelStartingPositionRef.current = getGridPosition(nextRoomId);
    }

    finishTurn();
  }
  //#endregion

  return {
    isCharged,
    toggleCharge,
    sceneFrameStore,
    currentEnemy,
    currentEnemyMaxHitPoints,
    currentRoomItem,
    currentRoomItemLabel,
    currentRoomItemSprite,
    currentRoomId,
    roomDoorways,
    roomSceneActors,
    disabledDirections,
    dungeonMap,
    enemyHealthLossAmount,
    hasLost,
    hasRoomEnemy,
    roomHasStairs,
    hasTurnTimer,
    hardTurnCounter: hasHardTurnCounter ? turnCounter : null,
    inventoryItem,
    inventoryItemLabel,
    inventoryItemActivationDescription,
    inventoryItemSprite,
    isResolving,
    level,
    playerEnergy,
    playerEnergyLossAmount,
    playerHealth,
    playerHealthLossAmount,
    playerScenePosition,
    attackMonster,
    defend,
    descend: () =>
      advanceToNextLevel(nextLevelStartingPositionRef.current ?? undefined),
    expireTurn,
    isGameLoopRunning,
    isTurnClockActive,
    turnStatus,
    turnDuration,
    turnNumber,
    turnTimeRemaining,
    updateGameFrame,
    moveToRoom,
    pickupItem,
  };
}
