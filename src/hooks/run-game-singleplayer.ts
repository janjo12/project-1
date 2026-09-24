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
  createLevelMap, getNextLevelState,
} from "@/hooks/run-game-level";
import { getRunSnapshot } from "@/hooks/run-game-snapshot";
import {
  applyDefense, getEquipmentStats, resolveEnergyLoss, resolveHealthLoss, resolveTurnLoss, resetRoomFeedback,
} from "@/hooks/run-game-items";
import { playerEntryPositions, PLAYER_MAX_ENERGY, PLAYER_MAX_HEALTH, type UseGameRunOptions } from "@/hooks/run-game-types";
import { restartAnimations, swapRoomItemWithInventory } from "@/hooks/run-game-helpers";
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
  addEquipmentToRoom,
  addItemToRoom,
  damageMonsterInRoom,
  getConnectedRoomId,
  getCurrentRoom,
  getRoom,
  getRoomMonster,
  getRoomEquipment,
  getTargetableRoomMonsterRefs,
  hasRoomStairs as checkRoomStairs,
  removeEquipmentFromRoom,
  revealRooms,
  unlockDoor,
} from "@/utils/dungeon-map-runtime";
import {
  createAndSaveSeededDungeonMap,
  saveDungeonMap,
  updateStoredDungeonMap,
} from "@/utils/dungeon-map-storage";
import { GAME_PARAMETERS } from "@/gameparameters";
import { randomGameClass } from "@/game-classes";
import { POSSIBLE_ITEMS } from "@/utils/dungeon-map";
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

export { PLAYER_MAX_ENERGY, PLAYER_MAX_HEALTH } from "@/hooks/run-game-types";

export function useRunGame({
  difficulty,
  onGameOver,
  seed,
  vibrationEnabled,
}: UseGameRunOptions) {
  //#region state and refs
  const [level, setLevel] = useState(1);
  const [playerClass] = useState(randomGameClass);
  const [clearedLevels, setClearedLevels] = useState(0);
  const [dungeonMap, setDungeonMap] = useState(() =>
    createLevelMap(seed, 1, undefined, difficulty !== "easy"),
  );
  const [inventoryItem, setInventoryItemState] = useState<ItemId | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
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
  const [playerEnergy, setPlayerEnergy] = useState(PLAYER_MAX_ENERGY);
  const [playerEnergyLossAmount, setPlayerEnergyLossAmount] = useState(0);
  const [playerHealth, setPlayerHealth] = useState(PLAYER_MAX_HEALTH);
  const [defenseBuff, setDefenseBuff] = useState(0);
  const defenseBuffRef = useRef(0);
  const vanguardRef = useRef(0);
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

    const isLocked = getRoom(dungeonMap, currentRoomId)?.[direction] === "locked";
    const usesKey = playerClass.id !== "thief" && inventoryItem === "key" && isLocked;
    const picksLock = playerClass.id === "thief" && isLocked;
    const opensLockedDoor = usesKey || picksLock;
    const mapWithOpenDoor = opensLockedDoor
      ? unlockDoor(dungeonMap, currentRoomId, direction)
      : dungeonMap;
    const nextRoomId = getConnectedRoomId(mapWithOpenDoor, currentRoomId, direction);

    if (!nextRoomId) {
      return;
    }

    const wasCharged = chargedRef.current;
    cancelCharge(false);
    if (wasCharged) setPlayerEnergy(energy => Math.min(PLAYER_MAX_ENERGY, energy + getEquipmentStats(equipment).chargeCost));
    const nextRoom = getRoom(dungeonMap, nextRoomId);

    resetFeedback();
    commitMap((map) => {
      const unlockedMap = opensLockedDoor
        ? unlockDoor(map, currentRoomId, direction)
        : map;
      return revealRooms(unlockedMap, nextRoomId, equipmentRef.current === "spyglass");
    });
    if (usesKey) {
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
