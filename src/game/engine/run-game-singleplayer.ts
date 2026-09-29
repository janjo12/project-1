import { createSceneFrameStore } from "@/game/state/sceneFrameStore";
import * as Haptics from "expo-haptics";
import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type SetStateAction,
} from "react";

import type { ScenePosition } from "@/components/Dungeon/GameViewPanel";
import {
  applyDefense, getEquipmentStats,
  resetRoomFeedback,
  resolveEnergyLoss, resolveHealthLoss,
} from "@/game/actions/items";
import { validateAction } from "@/game/actions/validateAction";
import { gameClassForSeed } from "@/game/config/game-classes";
import { GAME_PARAMETERS } from "@/game/config/gameparameters";
import {
  createAndSaveSeededDungeonMap,
  saveDungeonMap,
  updateStoredDungeonMap,
} from "@/game/dungeon/mapStorage";
import {
  addEquipmentToRoom,
  addItemToRoom,
  damageMonsterInRoom,
  getCurrentRoom,
  getRoomEquipment,
  getRoomMonster,
  removeEquipmentFromRoom
} from "@/game/dungeon/rooms";
import {
  POSSIBLE_ITEMS,
  type Direction,
  type DungeonMap as DungeonMapType,
  type GridPosition,
  type ItemId,
  type WorldMonster,
} from "@/game/dungeon/types";
import { getEnemyAttackOutcome } from "@/game/engine/combat";
import { resolveRoomMovement } from "@/game/engine/movement";
import {
  applyWerewolfChaseAfterAction,
  getHardTurnLimit, hasTurnLimit, resolveTurnLoss
} from "@/game/engine/resolveTurn";
import { restartAnimations, swapRoomItemWithInventory } from "@/game/engine/run-game-helpers";
import {
  getNextLevelState,
} from "@/game/engine/run-game-level";
import { getRunSnapshot } from "@/game/engine/run-game-snapshot";
import {
  advanceAnimationFrame,
} from "@/game/entities";
import { gameReducer, type GameStateAction } from "@/game/state/gameReducer";
import { createInitialGameState } from "@/game/state/initialGameState";
import type { GameState } from "@/game/state/types";
import { PLAYER_MAX_ENERGY, PLAYER_MAX_HEALTH, playerEntryPositions, type UseGameRunOptions } from "@/game/state/types";
export { getEnemyAttackOutcome } from "@/game/engine/combat";
export {
  applyWerewolfChaseAfterAction,
  getHardTurnLimit,
  getTurnDuration, HARD_TURN_LIMIT, hasTurnLimit,
  hasTurnTimer, TURN_DURATION
} from "@/game/engine/resolveTurn";
export { GameLoopTimer, runGameLoop } from "@/game/engine/run-game-loop";

export { PLAYER_MAX_ENERGY, PLAYER_MAX_HEALTH } from "@/game/state/types";

export function useRunGame({
  difficulty,
  istest,
  onGameOver,
  seed,
  vibrationEnabled,
}: UseGameRunOptions) {
  const [gameState, dispatchGameState] = useReducer(
    gameReducer,
    { difficulty, seed },
    createInitialGameState,
  );
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;
  const setGameField = useCallback(<Field extends keyof GameState>(
    field: Field,
    value: SetStateAction<GameState[Field]>,
  ) => {
    const previous = gameStateRef.current[field];
    const nextValue = typeof value === "function"
      ? (value as (value: GameState[Field]) => GameState[Field])(previous)
      : value;
    gameStateRef.current = { ...gameStateRef.current, [field]: nextValue };
    dispatchGameState({ type: "SET_FIELD", field, value: nextValue } as GameStateAction);
  }, []);
  const {
    level,
    clearedLevels,
    dungeonMap,
    inventoryItem,
    equipment,
    playerEnergy,
    playerHealth,
    turnCounter,
    turnNumber,
    turnTimeRemaining,
  } = gameState;
  const setLevel = useCallback((value: SetStateAction<number>) => setGameField("level", value), [setGameField]);
  const [playerClass] = useState(() => gameClassForSeed(seed));
  const setClearedLevels = useCallback((value: SetStateAction<number>) => setGameField("clearedLevels", value), [setGameField]);
  const setDungeonMap = useCallback((value: SetStateAction<DungeonMapType>) => setGameField("dungeonMap", value), [setGameField]);
  const setInventoryItemState = useCallback((value: SetStateAction<ItemId | null>) => setGameField("inventoryItem", value), [setGameField]);
  const setEquipment = useCallback((value: SetStateAction<string | null>) => setGameField("equipment", value), [setGameField]);
  const equipmentRef = useRef<string | null>(null);
  const setHeldEquipment = useCallback((item: string | null) => { equipmentRef.current = item; setEquipment(item); }, []);
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
  const lastActionRefundsChargeRef = useRef(false);
  const setPlayerEnergy = useCallback((value: SetStateAction<number>) => setGameField("playerEnergy", value), [setGameField]);
  const [playerEnergyLossAmount, setPlayerEnergyLossAmount] = useState(0);
  const setPlayerHealth = useCallback((value: SetStateAction<number>) => setGameField("playerHealth", value), [setGameField]);
  const [defenseBuff, setDefenseBuff] = useState(0);
  const defenseBuffRef = useRef(0);
  const vanguardRef = useRef(0);
  const [playerHealthLossAmount, setPlayerHealthLossAmount] = useState(0);
  const [playerScenePosition, setPlayerScenePosition] =
    useState<ScenePosition>("center");
  const setTurnCounter = useCallback((value: SetStateAction<number>) => setGameField("turnCounter", value), [setGameField]);
  const setTurnNumber = useCallback((value: SetStateAction<number>) => setGameField("turnNumber", value), [setGameField]);
  const setTurnTimeRemaining = useCallback((value: SetStateAction<number>) => setGameField("turnTimeRemaining", value), [setGameField]);

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
    equipmentLabel, equipmentDescription, equipmentSprite, visibleDungeonMap,
  } = getRunSnapshot({
    activeMonsterId,
    clearedLevels,
    difficulty,
    dungeonMap,
    inventoryItem,
    equipment,
    isResolving,
    level,
    playerEnergy,
    playerHealth,
    turnCounter,
  });
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

    if ("document" in globalThis) {
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

    const chargedMovementOrPickup = lastActionRefundsChargeRef.current;
    chargedRef.current = false;
    lastActionRefundsChargeRef.current = false;
    if (chargedMovementOrPickup) setPlayerEnergy(energy => Math.min(PLAYER_MAX_ENERGY, energy + getEquipmentStats(equipmentRef.current).chargeCost));
    setDefenseBuff(turns => Math.max(0, turns - 1));
    defenseBuffRef.current = Math.max(0, defenseBuffRef.current - 1);
    vanguardRef.current = Math.max(0, vanguardRef.current - 1);
    if (!chargedMovementOrPickup && playerEnergy === 0 && inventoryItemRef.current === "energy-meal") {
      setPlayerEnergy(resolveEnergyLoss(0, 0, inventoryItemRef.current).nextEnergy);
      setInventoryItem(null);
    }
    setIsCharged(false);

    if (hasTurnLimit(difficulty)) {
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

      if (getEquipmentStats(equipmentRef.current).turnDamage > 0) {
        const damage = getEquipmentStats(equipmentRef.current).turnDamage;
        setPlayerHealth(health => {
          let result = resolveHealthLoss(health, damage, inventoryItemRef.current);
          if (result.usesPotion) setInventoryItem(null);
          if (result.nextHealth <= 0 && !result.usesPotion && playerClass.id === "cleric" && playerEnergy > 0) {
            setPlayerEnergy(0);
            result = { nextHealth: playerEnergy, usesPotion: false };
          }
          if (result.nextHealth <= 0 && !result.usesPotion) schedule(0, () => onGameOver(clearedLevelsRef.current));
          return result.nextHealth;
        });
      }
      finishTurn();
    },
    [commitMap, finishTurn, onGameOver, playerClass, playerEnergy, schedule, setInventoryItem],
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
      let resolvedMap = mapAtEnd;

      const outcome = getEnemyAttackOutcome({
        isDefending,
        monsterDamage,
      });

      const counterattackDamage = isDefending && chargedRef.current
        ? GAME_PARAMETERS.combat.chargedCounterattackDamage : outcome.counterattackDamage;
      const classBaseDefense = GAME_PARAMETERS.player.defense + (playerClass.id === "warrior" ? 5 : 0);
      const damageTaken = isDefending && chargedRef.current ? 0 : applyDefense(outcome.damageTaken, classBaseDefense + getEquipmentStats(equipment).defense + defenseBuffRef.current + (isDefending && chargedRef.current ? 5 : 0));
      if (vanguardRef.current > 0) {
        const enemyDefense = mapAtEnd?.entities.monsters[monsterId]?.defense ?? dungeonMap.entities.monsters[monsterId]?.defense ?? 0;
        resolvedMap = commitMap(map => damageMonsterInRoom(map, roomId, monsterId, applyDefense(outcome.damageTaken, enemyDefense)), resolvedMap);
        vanguardRef.current = 0;
      }

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
        let finalMap = resolvedMap;

        if (isDefending) {
          finalMap = commitMap(
            (map) =>
              damageMonsterInRoom(
                map,
                roomId,
                monsterId,
                counterattackDamage,
              ),
            resolvedMap,
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

            if (nextHealth <= 0 && !usesPotion && playerClass.id === "cleric" && playerEnergy > 0) {
              const miracleHealth = playerEnergy;
              setPlayerEnergy(0);
              return miracleHealth;
            }
            if (nextHealth <= 0 && !usesPotion) {
              schedule(0, () => onGameOver(clearedLevelsRef.current));
            }

            return nextHealth;
          });

        finishNonMoveTurn({ mapAtEnd: finalMap, roomId });
      });
    },
    [commitMap, dungeonMap, finishNonMoveTurn, inventoryItem, equipment, playerClass, playerEnergy, onGameOver, schedule, setInventoryItem, triggerDamageHaptic, setAnimationFrame],
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
    const cost = getEquipmentStats(equipment).chargeCost;
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
  }, [equipment, hasLost, isResolving, playerEnergy, setAnimationFrame]);

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

  const cancelCharge = useCallback((refund = true) => {
    if (!chargedRef.current) return;
    chargedRef.current = false;
    setIsCharged(false);
    if (refund) setPlayerEnergy(energy => Math.min(PLAYER_MAX_ENERGY, energy + getEquipmentStats(equipment).chargeCost));
    setPlayerEnergyLossAmount(0);
  }, [equipment]);

  const commitPlayerAttack = useCallback((monster: WorldMonster, damage: number) => {
    lastActionRefundsChargeRef.current = false;
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
        lastActionRefundsChargeRef.current = false;
      cancelCharge(false);
        finishNonMoveTurn({ roomId: currentRoomId });
        return;
      }

      setTurnTimeRemaining(0);
      setIsResolving(true);
      lastActionRefundsChargeRef.current = false;

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
      cancelCharge,
    ],
  );

  const supportSelf = useCallback(() => {
    if (isResolving || hasLost) return;
    if (playerClass.id === "thief") {
      const chance = chargedRef.current ? 0.2 : 0.1;
      if (Math.random() < chance) {
        if (Math.random() < 0.5) {
          const found = POSSIBLE_ITEMS[Math.floor(Math.random() * POSSIBLE_ITEMS.length)];
          if (inventoryItem) commitMap(map => addItemToRoom(map, currentRoomId, found.id));
          else setInventoryItem(found.id);
        } else {
          const list = GAME_PARAMETERS.equipment;
          const found = list[Math.floor(Math.random() * list.length)];
          if (equipment) commitMap(map => addEquipmentToRoom(map, currentRoomId, found.id));
          else setHeldEquipment(found.id);
        }
      }
      cancelCharge(false);
      finishNonMoveTurn({ roomId: currentRoomId });
      return;
    }
    if (playerClass.id === "cleric") {
      defenseBuffRef.current = Math.max(defenseBuffRef.current, 2);
      setDefenseBuff(defenseBuffRef.current);
      if (chargedRef.current) setPlayerHealth(health => Math.min(PLAYER_MAX_HEALTH, health + 10));
    } else {
      vanguardRef.current = 1;
      if (chargedRef.current) { defenseBuffRef.current = Math.max(defenseBuffRef.current, 1); setDefenseBuff(defenseBuffRef.current); }
    }
    cancelCharge(false);
    if (hasRoomEnemy) {
      const enemy = getRoomMonster(dungeonMap, getCurrentRoom(dungeonMap));
      if (enemy) finishPlayerAction({ startedRoomId: currentRoomId });
    } else finishNonMoveTurn({ roomId: currentRoomId });
  }, [isResolving, hasLost, playerClass.id, chargedRef, inventoryItem, equipment, currentRoomId, commitMap, setInventoryItem, setHeldEquipment, cancelCharge, finishNonMoveTurn, hasRoomEnemy, dungeonMap, finishPlayerAction, setPlayerHealth]);

  const attackMonster = useCallback(
    (monsterId: string, attackScore?: number) => {
      if (isResolving || hasLost) {
        return;
      }

      if (!validateAction({
        action: { type: "ATTACK", monsterId },
        canUseKey: inventoryItem === "key",
        currentRoomId,
        isThief: playerClass.id === "thief",
        map: dungeonMap,
      })) {
        return;
      }
      const monster = dungeonMap.entities.monsters[monsterId];
      if (!monster || monster.currentHealth <= 0) return;

      const usesSilverBullet = monster.chases && inventoryItem === "silver-bullet";
      const hasEnergy = chargedRef.current;
      const rawDamage = usesSilverBullet
        ? monster.currentHealth
        : Math.floor(GAME_PARAMETERS.player.attack * (attackScore ?? 100) / 100) + getEquipmentStats(equipment).attack + (hasEnergy ? 5 : 0);
      lastActionRefundsChargeRef.current = false;
      const damage = applyDefense(rawDamage, monster.defense ?? 0);
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
      equipment,
      playerClass,
      currentRoomId,
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
  async function pickupItem() {
    if (isResolving || hasLost || !currentRoomItem || !currentRoomItemObject) {
    return;
    }

    const wasCharged = chargedRef.current;
    cancelCharge(false);
    if (wasCharged) setPlayerEnergy(energy => Math.min(PLAYER_MAX_ENERGY, energy + getEquipmentStats(equipment).chargeCost));
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

  function pickupEquipment() {
    if (isResolving || hasLost) return;
    const item = getRoomEquipment(dungeonMap, getCurrentRoom(dungeonMap));
    if (!item) return;
    const without = removeEquipmentFromRoom(dungeonMap, currentRoomId, item.id);
    const nextMap = equipment ? addEquipmentToRoom(without, currentRoomId, equipment) : without;
    commitMap(() => nextMap);
    setHeldEquipment(item.equipmentId);
    finishPlayerAction({ mapAtEnd: nextMap, startedRoomId: currentRoomId });
  }

  function dropEquipment() {
    if (isResolving || !equipment) return;
    const nextMap = addEquipmentToRoom(dungeonMap, currentRoomId, equipment);
    commitMap(() => nextMap);
    setHeldEquipment(null);
    if (chargedRef.current) cancelCharge();
  }

  async function moveToRoom(direction: Direction) {
    if (isResolving || hasLost) {
      return;
    }

    const movement = resolveRoomMovement({
      canUseKey: inventoryItem === "key",
      direction,
      isThief: playerClass.id === "thief",
      map: dungeonMap,
      revealAdjacent: equipmentRef.current === "spyglass",
      roomId: currentRoomId,
    });
    if (!movement || !validateAction({
      action: { type: "MOVE", direction },
      canUseKey: inventoryItem === "key",
      currentRoomId,
      isThief: playerClass.id === "thief",
      map: dungeonMap,
    })) {
      return;
    }

    const wasCharged = chargedRef.current;
    cancelCharge(false);
    if (wasCharged) setPlayerEnergy(energy => Math.min(PLAYER_MAX_ENERGY, energy + getEquipmentStats(equipment).chargeCost));
    resetFeedback();
    commitMap(() => movement.map);
    if (movement.usedKey) {
      setInventoryItem(null);
    }
    setPlayerScenePosition(playerEntryPositions[direction]);

    if (movement.startingPosition) nextLevelStartingPositionRef.current = movement.startingPosition;

    finishTurn();
  }

  return {
    istest,
    playerClass,
    playerLabel: `${playerClass.sprite} ${playerClass.name} · Support`,
    supportSelf,
    playerAttack: GAME_PARAMETERS.player.attack + getEquipmentStats(equipment).attack,
    playerDefense: GAME_PARAMETERS.player.defense + (playerClass.id === "warrior" ? 5 : 0) + getEquipmentStats(equipment).defense + defenseBuff,
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
    visibleDungeonMap,
    inventoryItem,
    equipment,
    equipmentLabel,
    equipmentDescription,
    equipmentSprite,
    pickupEquipment,
    dropEquipment,
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
