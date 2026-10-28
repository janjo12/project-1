import { createSceneFrameStore } from "@/game/state/sceneFrameStore";
import * as Haptics from "expo-haptics";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type SetStateAction,
} from "react";

import type { ScenePosition } from "@/components/Dungeon/GameViewPanel";
import {
  applyDefense, canUseInventoryItemImmediately, getEquipmentStats, recoverStat,
  resetRoomFeedback,
  resolveEnergyLoss, resolveHealthLoss,
} from "@/game/actions/items";
import { validateAction } from "@/game/actions/validateAction";
import { gameClassForSeed, getMicrogameEaseLevel } from "@/game/config/game-classes";
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
  getRoomEquipmentById,
  getRoomItemById,
  getRoomMonster,
  getWerewolf,
  getTargetableMonsters,
  revealRoomLootChest,
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
import { resolveRoomMovement } from "@/game/engine/movement";
import {
  applyWerewolfChaseAfterAction,
  getHardTurnLimit, hasTurnLimit, resolveTurnLoss
} from "@/game/engine/resolveTurn";
import { getPlayerAttackDamage, getPotentialAttackDamage, scaleMicrogameScore } from "@/game/engine/combat";
import { resolveClericMiracle } from "@/game/engine/cleric-miracle";
import { getWerewolfEntryPosition } from "@/game/engine/werewolf-transition";
import { restartAnimations, swapRoomItemWithInventory } from "@/game/engine/run-game-helpers";
import {
  getNextLevelState,
} from "@/game/engine/run-game-level";
import { getRunSnapshot } from "@/game/engine/run-game-snapshot";
import { advanceAnimationFrame } from "@/game/entities";
import { gameReducer, type GameStateAction } from "@/game/state/gameReducer";
import { createInitialGameState } from "@/game/state/initialGameState";
import { createNumberStore } from "@/game/state/numberStore";
import { PLAYER_MAX_ENERGY, PLAYER_MAX_HEALTH, directionScenePositions, playerEntryPositions, type GameState, type UseGameRunOptions } from "@/game/state/types";
import type { EntryPosition } from "@/components/Dungeon/RoomEntryAnimation";
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
  onDefenseRequested,
  seed,
  vibrationEnabled,
}: UseGameRunOptions) {
  const [gameState, dispatchGameState] = useReducer(
    gameReducer,
    { difficulty, seed },
    createInitialGameState,
  );
  const gameStateRef = useRef(gameState);
  const [turnClockStore] = useState(() => createNumberStore(gameState.turnTimeRemaining));
  useLayoutEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);
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
  } = gameState;
  const setLevel = useCallback((value: SetStateAction<number>) => setGameField("level", value), [setGameField]);
  const [playerClass] = useState(() => gameClassForSeed(seed));
  const setClearedLevels = useCallback((value: SetStateAction<number>) => setGameField("clearedLevels", value), [setGameField]);
  const setDungeonMap = useCallback((value: SetStateAction<DungeonMapType>) => setGameField("dungeonMap", value), [setGameField]);
  const setInventoryItemState = useCallback((value: SetStateAction<ItemId | null>) => setGameField("inventoryItem", value), [setGameField]);
  const setEquipment = useCallback((value: SetStateAction<string | null>) => setGameField("equipment", value), [setGameField]);
  const equipmentRef = useRef<string | null>(null);
  const setHeldEquipment = useCallback((item: string | null) => { equipmentRef.current = item; setEquipment(item); }, [setEquipment]);
  const inventoryItemRef = useRef<ItemId | null>(null);
  const setInventoryItem = useCallback((item: ItemId | null) => {
    inventoryItemRef.current = item;
    setInventoryItemState(item);
  }, [setInventoryItemState]);
  const timeoutIds = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearedLevelsRef = useRef(0);
  const clericMiracleUsedRef = useRef(false);
  const hardTurnGameOverScheduledRef = useRef(false);
  const werewolfHasBeenEncounteredRef = useRef(false);
  const werewolfEntryKey = useRef(0);
  const [werewolfEntry, setWerewolfEntry] = useState<{ roomId: string; position: EntryPosition; key: number } | null>(null);
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
  const [focusBoost, setFocusBoost] = useState(0);
  const focusBoostRef = useRef(0);
  const focusTurnsRef = useRef(0);
  const empoweredAttackBonusRef = useRef(0);
  const empoweredAttackTurnsRef = useRef(0);
  const defenseBuffRef = useRef(0);
  const defenseBuffTurnsRef = useRef(0);
  const vanguardRef = useRef(0);
  const [playerHealthLossAmount, setPlayerHealthLossAmount] = useState(0);
  const [playerScenePosition, setPlayerScenePosition] =
    useState<ScenePosition>("center");
  const setTurnCounter = useCallback((value: SetStateAction<number>) => setGameField("turnCounter", value), [setGameField]);
  const setTurnNumber = useCallback((value: SetStateAction<number>) => setGameField("turnNumber", value), [setGameField]);
  const setTurnTimeRemaining = useCallback((value: SetStateAction<number>) => {
    const previous = gameStateRef.current.turnTimeRemaining;
    const nextValue = typeof value === "function" ? value(previous) : value;
    turnClockStore.setSnapshot(nextValue);
    setGameField("turnTimeRemaining", nextValue);
  }, [setGameField, turnClockStore]);

  const {
    currentEnemy,
    currentEnemyMaxHitPoints,
    currentMonster,
    currentRoomId,
    currentRoomItem,
    currentRoomItemLabel,
    currentRoomItemSprite,
    disabledDirections,
    hasHardTurnCounter,
    hasLost,
    hasRoomEnemy,
    hasTurnTimer,
    inventoryItemLabel,
    inventoryItemDescription,
    inventoryItemActivationDescription,
    showUseItemNow,
    canUseItemNow,
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
        setWerewolfEntry(null);
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
  }, [difficulty, level, seed, setDungeonMap, setTurnCounter]);

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
    [dungeonMap, setDungeonMap],
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
      clericMiracleUsedRef.current = false;
      focusTurnsRef.current = 0;
      focusBoostRef.current = 0;
      setFocusBoost(0);
      empoweredAttackTurnsRef.current = 0;
      empoweredAttackBonusRef.current = 0;
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
      setWerewolfEntry(null);
      setTurnTimeRemaining(nextTurnDuration);
      setTurnNumber((number) => number + 1);
    },
    [difficulty, level, resetFeedback, seed, setClearedLevels, setDungeonMap, setLevel, setPlayerEnergy, setPlayerHealth, setTurnCounter, setTurnNumber, setTurnTimeRemaining],
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
    if (defenseBuffTurnsRef.current > 0) {
      defenseBuffTurnsRef.current -= 1;
      if (defenseBuffTurnsRef.current === 0) {
        defenseBuffRef.current = 0;
        setDefenseBuff(0);
      }
    }
    if (focusTurnsRef.current > 0) {
      focusTurnsRef.current -= 1;
      if (focusTurnsRef.current === 0 && focusBoostRef.current !== 0) {
        focusBoostRef.current = 0;
        setFocusBoost(0);
      }
    }
    if (empoweredAttackTurnsRef.current > 0) {
      empoweredAttackTurnsRef.current -= 1;
      if (empoweredAttackTurnsRef.current === 0) empoweredAttackBonusRef.current = 0;
    }
    vanguardRef.current = Math.max(0, vanguardRef.current - 1);
    if (!chargedMovementOrPickup && playerEnergy === 0 && inventoryItemRef.current === "energy-meal") {
      setPlayerEnergy(resolveEnergyLoss(0, 0, inventoryItemRef.current).nextEnergy);
      setInventoryItem(null);
    }
    setIsCharged(false);

    if (hasTurnLimit(difficulty)) {
      setTurnCounter((counter) => {
        const { nextCounter, usesClock } = resolveTurnLoss(counter, inventoryItemRef.current, level);

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
  }, [difficulty, level, onGameOver, playerEnergy, schedule, setInventoryItem, setPlayerEnergy, setTurnCounter, setTurnNumber, setTurnTimeRemaining, turnDuration]);

  const finishNonMoveTurn = useCallback(
    ({
      mapAtEnd,
      roomId,
    }: {
      mapAtEnd?: DungeonMapType;
      roomId: string;
    }) => {
      if (werewolfHasBeenEncounteredRef.current) {
        const mapBeforeChase = mapAtEnd ?? dungeonMap;
        const werewolf = getWerewolf(mapBeforeChase);
        const previousRoom = werewolf
          ? mapBeforeChase.rooms.flat().find(room => room.contents.some(content => content.type === "monster" && content.id === werewolf.id))
          : undefined;
        if (previousRoom && previousRoom.id !== roomId) {
          const key = ++werewolfEntryKey.current;
          setWerewolfEntry({ roomId, position: getWerewolfEntryPosition(previousRoom.id, roomId), key });
          schedule(GAME_PARAMETERS.animation.roomEntryDurationMs, () => {
            setWerewolfEntry(current => current?.key === key ? null : current);
          });
        }
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
          const result = resolveHealthLoss(health, damage, inventoryItemRef.current);
          if (result.usesPotion) setInventoryItem(null);
          const miracle = resolveClericMiracle({
            alreadyUsed: clericMiracleUsedRef.current,
            classId: playerClass.id,
            healthAfterDamage: result.nextHealth,
            usedPotion: result.usesPotion,
          });
          if (miracle.triggered) clericMiracleUsedRef.current = true;
          if (miracle.health <= 0 && !result.usesPotion) schedule(0, () => onGameOver(clearedLevelsRef.current));
          return miracle.health;
        });
      }
      finishTurn();
    },
    [commitMap, dungeonMap, finishTurn, onGameOver, playerClass, schedule, setInventoryItem, setPlayerHealth],
  );

  const startEnemyMove = useCallback(
    ({
      enemyIds,
      mapAtEnd,
      roomId,
    }: {
      enemyIds: string[];
      mapAtEnd?: DungeonMapType;
      roomId: string;
    }) => {
      const takeEnemyTurn = (index: number, currentMap?: DungeonMapType) => {
        const liveMap = currentMap ?? mapAtEnd ?? dungeonMap;
        const monsterId = enemyIds[index];
        const monster = liveMap.entities.monsters[monsterId];
        if (!monster || monster.currentHealth <= 0) {
          if (index + 1 < enemyIds.length) takeEnemyTurn(index + 1, liveMap);
          else finishNonMoveTurn({ mapAtEnd: liveMap, roomId });
          return;
        }

        setActiveMonsterId(monsterId);
        restartAnimations(setAnimationFrame, ["enemyAttackElapsed"]);
        let resolvedMap = currentMap;
        // Vanguard's reflected damage is consumed by the first enemy that attacks this turn.
        const reflects = vanguardRef.current > 0;
        const classBaseDefense = GAME_PARAMETERS.player.defense + (playerClass.id === "warrior" ? 5 : 0);
        const damageAfterEquipment = applyDefense(
          monster.damage,
          classBaseDefense + getEquipmentStats(equipment).defense + defenseBuffRef.current,
        );

        if (reflects) {
          const reflectedDamage = Math.min(
            monster.currentHealth,
            GAME_PARAMETERS.combat.warriorRiposteDamage,
          );
          console.info(`[combat] Player reflected ${reflectedDamage} damage to ${monster.name}.`);
          setEnemyHealthLossAmount(GAME_PARAMETERS.combat.warriorRiposteDamage);
          restartAnimations(setAnimationFrame, ["playerAttackElapsed", "enemyDamageElapsed", "enemyHealthLossElapsed"]);
          resolvedMap = commitMap(
            map => damageMonsterInRoom(map, roomId, monsterId, reflectedDamage),
            resolvedMap,
          );
          vanguardRef.current = 0;
        }

        const resolveAttack = (defenseScore: number) => {
          const safeScore = Math.max(0, Math.min(100, scaleMicrogameScore(defenseScore, difficulty)));
          const damageTaken = Math.ceil(damageAfterEquipment * (100 - safeScore) / 100);
          console.info(
            `[combat] ${monster.name} dealt ${damageTaken} damage to Player (${damageTaken === 0 ? "blocked" : `base ${monster.damage}, reduced by ${monster.damage - damageTaken} defense and reaction`}).`,
          );

          schedule(GAME_PARAMETERS.animation.attackImpactDelayMs, () => {
            setPlayerHealthLossAmount(damageTaken);
            restartAnimations(setAnimationFrame, ["playerDamageElapsed", "playerHealthLossElapsed"]);
            if (damageTaken > 0) triggerDamageHaptic();
          });

          schedule(GAME_PARAMETERS.animation.enemyTurnDurationMs, () => {
            const finalMap = resolvedMap;
            setPlayerHealth(health => {
              const { nextHealth, usesPotion } = resolveHealthLoss(health, damageTaken, inventoryItemRef.current);
              if (usesPotion) setInventoryItem(null);
              const miracle = resolveClericMiracle({
                alreadyUsed: clericMiracleUsedRef.current,
                classId: playerClass.id,
                healthAfterDamage: nextHealth,
                usedPotion: usesPotion,
              });
              if (miracle.triggered) clericMiracleUsedRef.current = true;
              if (miracle.health <= 0 && !usesPotion) schedule(0, () => onGameOver(clearedLevelsRef.current));
              return miracle.health;
            });

            if (index + 1 < enemyIds.length) takeEnemyTurn(index + 1, finalMap);
            else finishNonMoveTurn({ mapAtEnd: finalMap, roomId });
          });
        };

        if (onDefenseRequested) onDefenseRequested(resolveAttack);
        else resolveAttack(0);
      };

      takeEnemyTurn(0, mapAtEnd);
    },
    [commitMap, dungeonMap, finishNonMoveTurn, equipment, onDefenseRequested, playerClass, onGameOver, schedule, setInventoryItem, setPlayerHealth, triggerDamageHaptic, setAnimationFrame],
  );

  const finishPlayerAction = useCallback(
    ({
      mapAtEnd,
      startedRoomId,
    }: {
      mapAtEnd?: DungeonMapType;
      startedRoomId: string;
    }) => {
      const roomAtEnd = getCurrentRoom(mapAtEnd ?? dungeonMap);
      const enemiesAtEnd = getTargetableMonsters(mapAtEnd ?? dungeonMap, roomAtEnd);

      if (roomAtEnd?.id === startedRoomId && enemiesAtEnd.length > 0) {
        setActiveMonsterId(enemiesAtEnd[0].id);
        setIsResolving(true);
        startEnemyMove({
          enemyIds: enemiesAtEnd.map(enemy => enemy.id),
          mapAtEnd,
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
  }, [equipment, hasLost, isResolving, playerEnergy, setAnimationFrame, setPlayerEnergy]);

  const animatePlayerAttack = useCallback((damageAmount: number) => {
    restartAnimations(setAnimationFrame, ["playerAttackElapsed"]);

    schedule(GAME_PARAMETERS.animation.attackImpactDelayMs, () => {
      setEnemyHealthLossAmount(damageAmount);
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
  }, [equipment, setPlayerEnergy]);

  const useItemNow = useCallback(() => {
    const item = inventoryItemRef.current;
    if (isResolving || hasLost || !canUseInventoryItemImmediately(item, playerHealth, playerEnergy)) return false;

    cancelCharge();
    lastActionRefundsChargeRef.current = false;
    setInventoryItem(null);
    if (item === "health-potion") setPlayerHealth(health => recoverStat(health, PLAYER_MAX_HEALTH));
    else if (item === "energy-meal") setPlayerEnergy(energy => recoverStat(energy, PLAYER_MAX_ENERGY));
    else if (item === "clock") {
      setTurnCounter(counter => counter + GAME_PARAMETERS.turn.clockBaseTurns + level);
      hardTurnGameOverScheduledRef.current = false;
    }

    finishPlayerAction({ startedRoomId: currentRoomId });
    return true;
  }, [cancelCharge, currentRoomId, finishPlayerAction, hasLost, isResolving, level, playerEnergy, playerHealth, setInventoryItem, setPlayerEnergy, setPlayerHealth, setTurnCounter]);

  const commitPlayerAttack = useCallback((monster: WorldMonster, damage: number, chainTargets: WorldMonster[] = []) => {
    lastActionRefundsChargeRef.current = false;
    schedule(GAME_PARAMETERS.animation.attackDurationMs, () => {
      const nextMap = commitMap(map => {
        let attackedMap = damageMonsterInRoom(map, currentRoomId, monster.id, damage);
        const chainDamage = Math.floor(damage / 2);
        if (playerClass.id === "wizard" && chainDamage > 0) {
          for (const chainTarget of chainTargets) {
            attackedMap = damageMonsterInRoom(attackedMap, currentRoomId, chainTarget.id, chainDamage);
          }
        }
        return attackedMap;
      });

      finishPlayerAction({
        mapAtEnd: nextMap,
        startedRoomId: currentRoomId,
      });
    });
  }, [commitMap, currentRoomId, finishPlayerAction, playerClass.id, schedule]);

  // This is the sole player-triggered support action; its effect comes from the selected class.
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
      defenseBuffRef.current = Math.max(defenseBuffRef.current, 5);
      defenseBuffTurnsRef.current = Math.max(defenseBuffTurnsRef.current, 2);
      setDefenseBuff(defenseBuffRef.current);
      if (chargedRef.current) setPlayerHealth(health => Math.min(PLAYER_MAX_HEALTH, health + 10));
    } else if (playerClass.id === "archer") {
      focusBoostRef.current = Math.max(focusBoostRef.current, chargedRef.current ? 3 : 2);
      focusTurnsRef.current = Math.max(focusTurnsRef.current, 2);
      setFocusBoost(focusBoostRef.current);
    } else if (playerClass.id === "wizard") {
      empoweredAttackBonusRef.current = Math.max(empoweredAttackBonusRef.current, chargedRef.current ? 10 : 5);
      empoweredAttackTurnsRef.current = Math.max(empoweredAttackTurnsRef.current, 3);
    } else {
      vanguardRef.current = 1;
      if (chargedRef.current) {
        defenseBuffRef.current = Math.max(defenseBuffRef.current, 5);
        defenseBuffTurnsRef.current = Math.max(defenseBuffTurnsRef.current, 1);
        setDefenseBuff(defenseBuffRef.current);
      }
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
        return false;
      }

      if (!validateAction({
        action: { type: "ATTACK", monsterId },
        canUseKey: inventoryItem === "key",
        currentRoomId,
        isThief: playerClass.id === "thief",
        map: dungeonMap,
      })) {
        return false;
      }
      const monster = dungeonMap.entities.monsters[monsterId];
      if (!monster || monster.currentHealth <= 0) return false;

      const usesSilverBullet = monster.chases && inventoryItem === "silver-bullet";
      const hasEnergy = chargedRef.current;
      const totalDamage = usesSilverBullet
        ? monster.currentHealth
        : getPotentialAttackDamage({
          profile: getPlayerAttackDamage(monster, hasEnergy, playerClass.id) + empoweredAttackBonusRef.current,
          score: attackScore ?? 100,
          equipmentAttack: getEquipmentStats(equipment).attack,
          charged: hasEnergy,
          difficulty,
          target: monster,
        });
      lastActionRefundsChargeRef.current = false;
      const damage = Math.min(monster.currentHealth, totalDamage);
      const chainTargets = playerClass.id === "wizard" && damage > 0
        ? getTargetableMonsters(dungeonMap, getCurrentRoom(dungeonMap)).filter(target => target.id !== monster.id)
        : [];
      const healthLost = damage;
      console.info(
        `[combat] Player dealt ${healthLost} damage to ${monster.name}${usesSilverBullet ? " with a Silver Arrow" : monster.chases ? " (immune to ordinary attacks)" : ""}.`,
      );

      setTurnTimeRemaining(0);
      setIsResolving(true);
      setActiveMonsterId(monsterId);

      if (usesSilverBullet) {
        setInventoryItem(null);
      }

      animatePlayerAttack(totalDamage);
      commitPlayerAttack(monster, damage, chainTargets);
      return true;
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
      setTurnTimeRemaining,
    ],
  );

  const isTurnClockActive = useCallback(
    () => hasTurnTimer && !hasLost && !isResolving,
    [hasLost, hasTurnTimer, isResolving],
  );

  const isGameLoopRunning = useCallback(() => !hasLost, [hasLost]);

  const updateGameFrame = useCallback(
    (delta: number, nextTurnTimeRemaining?: number) => {
      const frame = sceneFrameStore.getSnapshot();
      const nextFrame = advanceAnimationFrame(frame, delta);
      if (nextFrame !== frame) setAnimationFrame(nextFrame);

      if (typeof nextTurnTimeRemaining === "number") {
        turnClockStore.setSnapshot(Math.ceil(Math.max(0, nextTurnTimeRemaining) / 100) * 100);
      }
    },
    [sceneFrameStore, setAnimationFrame, turnClockStore],
  );

  const expireTurn = useCallback(() => {
    if (isResolving || hasLost) return;
    setTurnTimeRemaining(0);
    lastActionRefundsChargeRef.current = false;
    // A timeout forfeits the action. It grants neither class support nor a generic defense bonus.
    cancelCharge();
    finishPlayerAction({ startedRoomId: currentRoomId });
  }, [cancelCharge, currentRoomId, finishPlayerAction, hasLost, isResolving, setTurnTimeRemaining]);
  async function pickupItem(itemInstanceId?: string): Promise<boolean> {
    const currentRoom = getCurrentRoom(dungeonMap);
    const selectedId = itemInstanceId ?? currentRoom.contents.find(content => content.type === "item")?.id;
    const selected = selectedId ? getRoomItemById(dungeonMap, currentRoom, selectedId) : null;
    const pickedItemObject = selected?.item ?? null;
    const pickedItemId = pickedItemObject?.itemId ?? null;
    if (isResolving || hasLost || !pickedItemId || !pickedItemObject) {
      return false;
    }

    if (selected?.reference.isChest && inventoryItemRef.current) {
      commitMap(map => revealRoomLootChest(map, currentRoomId, pickedItemObject.id, "item"));
      return false;
    }

    const wasCharged = chargedRef.current;
    cancelCharge(false);
    if (wasCharged) setPlayerEnergy(energy => Math.min(PLAYER_MAX_ENERGY, energy + getEquipmentStats(equipment).chargeCost));
    const nextInventoryItem = pickedItemId;

    const nextMap = commitMap((map) =>
      swapRoomItemWithInventory({
        currentRoomId,
        currentRoomItemId: pickedItemObject.id,
        dungeonMap: map,
        inventoryItem: inventoryItemRef.current,
      }),
    );
    setInventoryItem(nextInventoryItem);
    finishPlayerAction({ mapAtEnd: nextMap, startedRoomId: currentRoomId });
    return true;
  }

  function pickupEquipment(equipmentInstanceId?: string): boolean {
    if (isResolving || hasLost) return false;
    const currentRoom = getCurrentRoom(dungeonMap);
    const selectedId = equipmentInstanceId ?? currentRoom.contents.find(content => content.type === "equipment")?.id;
    const selected = selectedId ? getRoomEquipmentById(dungeonMap, currentRoom, selectedId) : null;
    const item = selected?.equipment ?? null;
    if (!item) return false;
    if (selected?.reference.isChest && equipment) {
      commitMap(map => revealRoomLootChest(map, currentRoomId, item.id, "equipment"));
      return false;
    }
    const without = removeEquipmentFromRoom(dungeonMap, currentRoomId, item.id);
    const nextMap = equipment ? addEquipmentToRoom(without, currentRoomId, equipment, false) : without;
    commitMap(() => nextMap);
    setHeldEquipment(item.equipmentId);
    finishPlayerAction({ mapAtEnd: nextMap, startedRoomId: currentRoomId });
    return true;
  }

  function openLootChest(id: string, type: "item" | "equipment") {
    if (isResolving || hasLost) return;
    commitMap(map => revealRoomLootChest(map, currentRoomId, id, type));
  }

  function dropEquipment() {
    if (isResolving || !equipment) return;
    const nextMap = addEquipmentToRoom(dungeonMap, currentRoomId, equipment, false);
    commitMap(() => nextMap);
    setHeldEquipment(null);
    if (chargedRef.current) cancelCharge();
  }

  function dropItem() {
    if (isResolving || hasLost || !inventoryItem) return;
    commitMap(map => addItemToRoom(map, currentRoomId, inventoryItem, false));
    setInventoryItem(null);
  }

  async function moveToRoom(direction: Direction) {
    if (isResolving || hasLost) {
      return false;
    }

    const movement = resolveRoomMovement({
      canUseKey: inventoryItem === "key",
      direction,
      isThief: playerClass.id === "thief",
      isCharged: chargedRef.current,
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
      return false;
    }

    const wasCharged = chargedRef.current;
    cancelCharge(false);
    if (wasCharged) setPlayerEnergy(energy => Math.min(PLAYER_MAX_ENERGY, energy + getEquipmentStats(equipment).chargeCost));
    resetFeedback();
    if (movement.roomId !== currentRoomId) {
      setIsResolving(true);
      setPlayerScenePosition(directionScenePositions[direction]);
      schedule(GAME_PARAMETERS.animation.roomExitDurationMs, () => {
        commitMap(() => movement.map);
        if (movement.usedKey) setInventoryItem(null);
        setPlayerScenePosition(playerEntryPositions[direction]);
        if (movement.startingPosition) nextLevelStartingPositionRef.current = movement.startingPosition;
        schedule(GAME_PARAMETERS.animation.roomTransitionDurationMs, finishTurn);
      });
      return true;
    }

    commitMap(() => movement.map);
    if (movement.usedKey) setInventoryItem(null);
    finishTurn();
    return movement.roomId !== currentRoomId;
  }

  const visibleRoomSceneActors = roomSceneActors.map(actor => actor.isWerewolf && werewolfEntry?.roomId === currentRoomId
    ? { ...actor, isEntering: true, entryPosition: werewolfEntry.position }
    : actor);

  return {
    istest,
    playerClass,
    playerLabel: `${playerClass.sprite} ${playerClass.name} · Support`,
    supportSelf,
    playerAttack: GAME_PARAMETERS.combat.normalAttackDamage + (playerClass.id === "wizard" ? 3 : 0) + getEquipmentStats(equipment).attack,
    playerDefense: GAME_PARAMETERS.player.defense + (playerClass.id === "warrior" ? 5 : 0) + getEquipmentStats(equipment).defense + defenseBuff,
    isCharged,
    toggleCharge,
    microgameEaseLevel: getMicrogameEaseLevel(playerClass.id, focusBoost),
    useItemNow,
    sceneFrameStore,
    currentEnemy,
    currentEnemyMaxHitPoints,
    currentRoomItem,
    currentRoomItemLabel,
    currentRoomItemSprite,
    currentRoomId,
    roomDoorways,
    roomSceneActors: visibleRoomSceneActors,
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
    openLootChest,
    dropEquipment,
    inventoryItemLabel,
    inventoryItemDescription,
    inventoryItemActivationDescription,
    showUseItemNow,
    canUseItemNow,
    inventoryItemSprite,
    isResolving,
    level,
    playerEnergy,
    playerEnergyLossAmount,
    playerHealth,
    playerHealthLossAmount,
    playerScenePosition,
    attackMonster,
    descend: () =>
      advanceToNextLevel(nextLevelStartingPositionRef.current ?? undefined),
    expireTurn,
    isGameLoopRunning,
    isTurnClockActive,
    turnStatus,
    turnDuration,
    turnNumber,
    get turnTimeRemaining() { return turnClockStore.getSnapshot(); },
    turnClockStore,
    updateGameFrame,
    moveToRoom,
    pickupItem,
    dropItem,
  };
}
