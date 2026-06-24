//#region imports
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

import type {
  RoomDoorways,
  RoomSceneActor,
  ScenePosition,
} from "@/components/game-view-panel";
import {
  advanceAnimationFrame,
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
  getActiveRooms,
  getConnectedRoomId,
  getCurrentRoom,
  getCurrentRoomId,
  getDoorwayGuardPlacement,
  getGridPosition,
  getGuardedDirections,
  getLockedDirections,
  getRoom,
  getRoomItem,
  getRoomItemId,
  getRoomMonster,
  moveCurrentPosition,
  moveWerewolfToRoom,
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
//#endregion

//#region constants and types
export const PLAYER_MAX_HEALTH = PLAYER.maxHealth;
export const PLAYER_MAX_ENERGY = PLAYER.maxEnergy;
export const HARD_TURN_LIMIT = 30;
export const TURN_DURATION = 6000;

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

const directionScenePositions = {
  east: "right",
  north: "top",
  south: "bottom",
  west: "left",
} satisfies Record<Direction, ScenePosition>;

const defaultRoomDoorways: RoomDoorways = {
  bottom: "wall",
  left: "wall",
  right: "wall",
  top: "wall",
};

const playerEntryPositions = {
  east: "left",
  north: "bottom",
  south: "top",
  west: "right",
} satisfies Record<Direction, ScenePosition>;

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
  turnDuration: number;
};

type GameLoopEntities = {
  gameLoop: GameLoopEntity;
};
//#endregion

//#region game loop and system
export class GameLoopTimer { // this is a custom timer class that can be started and stopped, and allows subscribers to be notified of the elapsed time at regular intervals
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
) => { // this is the main game loop system that advances the game state based on the elapsed time and turn timer
  const loop = entities.gameLoop;

  if (!loop) {
    return entities;
  }

  const delta = Math.max(0, time.delta || GAME_LOOP_TICK);
  let turnTimeRemaining: number | undefined;
  let didExpire = false;
  const turnDuration = Math.max(1, loop.turnDuration);

  if (loop.isTurnClockActive() && !loop.expired) {
    loop.elapsed = Math.min(turnDuration, loop.elapsed + delta);
    turnTimeRemaining = turnDuration - loop.elapsed;

    if (loop.elapsed >= turnDuration) {
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
//#endregion

//#region helper functions
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

export function getHardTurnLimit({ // the hard turn limit is determined by the number of active rooms in the level, multiplied by a factor (in this case, 3)
  difficulty,
  map,
  level,
  seed,
}: {
  difficulty: Difficulty;
  map: DungeonMapType;
  level: number;
  seed: string;
}) {
  void level;
  void seed;

  if (difficulty !== "hard") {
    return HARD_TURN_LIMIT;
  }

  return Math.max(1, getActiveRooms(map).length * 3);
}

export function getTurnDuration({ // the turn duration is determined by the difficulty and level, with a minimum of 2000ms
  difficulty,
  level,
}: {
  difficulty: Difficulty;
  level: number;
}) {
  const startingDuration = difficulty === "hard" ? 5000 : TURN_DURATION;

  return Math.max(2000, startingDuration - (level - 1) * 30);
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

function getRoomDoorways(room: ReturnType<typeof getCurrentRoom>): RoomDoorways {
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

function createMonsterSceneActor({
  isActive,
  monster,
  position,
}: {
  isActive: boolean;
  monster: WorldMonster;
  position: ScenePosition;
}): RoomSceneActor {
  return {
    currentHealth: monster.currentHealth,
    sprite: monster.sprite,
    kind: "enemy",
    isActive,
    label: monster.name,
    maxHealth: monster.maximumHealth,
    position,
  };
}

function getRoomSceneActors({
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

  room.contents.forEach((content) => {
    if (content.type === "monster") {
      const monster = dungeonMap.entities.monsters[content.id];

      if (!monster || monster.currentHealth <= 0 || seenMonsterIds.has(monster.id)) {
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
      return;
    }

    if (content.type === "item") {
      const item = dungeonMap.entities.items[content.id];

      if (!item || seenItemIds.has(item.id)) {
        return;
      }

      seenItemIds.add(item.id);
      sceneActors.push({
        sprite: item.sprite ?? item.label,
        kind: "item",
        label: item.label,
        position: "center",
      });
      return;
    }

    if (content.type === "stairs") {
      sceneActors.push({
        sprite: "\uD83E\uDE9C",
        kind: "stairs",
        label: "Stairs",
        position: "center",
      });
    }
  });

  getGuardedDirections(dungeonMap, room.id).forEach((direction) => {
    const guard = getDoorwayGuardPlacement(dungeonMap, room.id, direction);
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

  return sceneActors;
}

type RunSnapshotOptions = {
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

function getInventoryItemSprite(itemId: ItemId | null) {
  return itemId
    ? (POSSIBLE_ITEMS.find((item) => item.id === itemId)?.sprite ?? null)
    : null;
}

function getCurrentEnemy(monster: WorldMonster | null) {
  return monster
    ? {
        sprite: monster.sprite,
        hitPoints: monster.currentHealth,
        name: monster.name,
      }
    : null;
}

function getRunSnapshot({
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
  const hasHardTurnCounter = difficulty === "hard";
  const hasLost = playerHealth <= 0 || (hasHardTurnCounter && turnCounter <= 0);
  const hasTurnTimer = difficulty !== "easy";
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
      isResolving,
      roomId: currentRoomId,
    }),
    hasHardTurnCounter,
    hasLost,
    hasRoomEnemy,
    hasTurnTimer,
    inventoryItemLabel: getItemLabel(inventoryItem),
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
      currentMonsterId,
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

function getPlayerAttackDamage(action: PlayerAction, monster: WorldMonster) {
  if (monster.chases) {
    return 0;
  }

  return action === "special" ? 2 : 1;
}

function getNextLevelState({
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
  const nextMap = createLevelMap(seed, nextLevel, startingPosition);

  return {
    nextClearedLevels,
    nextLevel,
    nextMap,
    nextTurnCounter: getHardTurnLimit({
      difficulty,
      level: nextLevel,
      map: nextMap,
      seed,
    }),
    nextTurnDuration: getTurnDuration({ difficulty, level: nextLevel }),
  };
}

function recoverStat(current: number, maximum: number) {
  return Math.min(maximum, current + maximum / 2);
}

function swapRoomItemWithInventory({
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

export function useRunGame({
  difficulty,
  onGameOver,
  seed,
  vibrationEnabled,
}: UseGameRunOptions) { // this is the main hook that manages the game state and logic, including the player's stats, current room and monster, inventory, animations, and turn resolution
  const initialDungeonMapRef = useRef<DungeonMapType | null>(null);
  const [level, setLevel] = useState(1);
  const [clearedLevels, setClearedLevels] = useState(0);
  const [dungeonMap, setDungeonMap] = useState(() => {
    const map = createLevelMap(seed, 1);

    initialDungeonMapRef.current = map;

    return map;
  });
  const [inventoryItem, setInventoryItem] = useState<ItemId | null>(null);
  const timeoutIds = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearedLevelsRef = useRef(0);
  const hardTurnGameOverScheduledRef = useRef(false);
  const werewolfHasBeenEncounteredRef = useRef(false);
  const nextLevelStartingPositionRef = useRef<GridPosition | null>(null);
  const [animationFrame, setAnimationFrame] =
    useState<CombatAnimationFrame>(createCombatAnimationFrame);
  const [enemyHealthLossAmount, setEnemyHealthLossAmount] = useState(0);
  const [isResolving, setIsResolving] = useState(false);
  const [playerEnergy, setPlayerEnergy] = useState(PLAYER_MAX_ENERGY);
  const [playerEnergyLossAmount, setPlayerEnergyLossAmount] = useState(0);
  const [playerHealth, setPlayerHealth] = useState(PLAYER_MAX_HEALTH);
  const [playerHealthLossAmount, setPlayerHealthLossAmount] = useState(0);
  const [playerScenePosition, setPlayerScenePosition] =
    useState<ScenePosition>("center");
  const [turnCounter, setTurnCounter] = useState(() =>
    getHardTurnLimit({
      difficulty,
      level: 1,
      map: initialDungeonMapRef.current ?? createLevelMap(seed, 1),
      seed,
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
    inventoryItemSprite,
    isItemDisabled,
    roomDoorways,
    roomHasStairs,
    roomSceneActors,
    turnDuration,
    turnStatus,
  } = getRunSnapshot({
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
      );

      if (isMounted) {
        werewolfHasBeenEncounteredRef.current = false;
        setDungeonMap(nextMap);
        setTurnCounter(
          getHardTurnLimit({
            difficulty,
            level,
            map: nextMap,
            seed,
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
    setTurnTimeRemaining(turnDuration);
    setIsResolving(false);
    setTurnNumber((number) => number + 1);

    if (difficulty === "hard") {
      setTurnCounter((counter) => {
        const nextCounter = Math.max(0, counter - 1);

        if (nextCounter <= 0 && !hardTurnGameOverScheduledRef.current) {
          hardTurnGameOverScheduledRef.current = true;
          schedule(0, () => onGameOver(clearedLevelsRef.current));
        }

        return nextCounter;
      });
    }
  }, [difficulty, onGameOver, schedule, turnDuration]);

  const startEnemyMove = useCallback(
    ({
      isDefending,
      mapAtEnd,
      monsterDamage,
      roomId,
    }: {
      isDefending: boolean;
      mapAtEnd?: DungeonMapType;
      monsterDamage: number;
      roomId: string;
    }) => {
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

        if (werewolfHasBeenEncounteredRef.current) {
          commitMap((map) => moveWerewolfToRoom(map, roomId), mapAtEnd);
        }

        finishTurn();
      });
    },
    [commitMap, finishTurn, onGameOver, schedule, triggerDamageHaptic],
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
        startEnemyMove({
          isDefending,
          mapAtEnd,
          monsterDamage: monsterAtEnd.damage,
          roomId: startedRoomId,
        });
        return;
      }

      finishTurn();
    },
    [dungeonMap, finishTurn, startEnemyMove],
  );

  const spendSpecialEnergy = useCallback(() => {
    setPlayerEnergyLossAmount(1);
    restartAnimations(setAnimationFrame, ["playerEnergyLossElapsed"]);
    setPlayerEnergy((energy) => Math.max(0, energy - 1));
  }, []);

  const animatePlayerAttack = useCallback((healthLost: number) => {
    restartAnimations(setAnimationFrame, ["playerAttackElapsed"]);

    schedule(250, () => {
      setEnemyHealthLossAmount(healthLost);
      restartAnimations(setAnimationFrame, [
        "enemyDamageElapsed",
        "enemyHealthLossElapsed",
      ]);
    });
  }, [schedule]);

  const commitPlayerAttack = useCallback((monster: WorldMonster, damage: number) => {
    schedule(500, () => {
      const nextMap = commitMap((map) =>
        damageMonsterInRoom(map, currentRoomId, monster.id, damage),
      );

      finishPlayerAction({
        mapAtEnd: nextMap,
        startedRoomId: currentRoomId,
      });
    });
  }, [commitMap, currentRoomId, finishPlayerAction, schedule]);

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

      const damage = getPlayerAttackDamage(action, currentMonster);
      const healthLost = Math.min(currentMonster.currentHealth, damage);

      if (action === "special") {
        spendSpecialEnergy();
      }

      animatePlayerAttack(healthLost);
      commitPlayerAttack(currentMonster, damage);
    },
    [
      animatePlayerAttack,
      commitPlayerAttack,
      currentMonster,
      finishPlayerAction,
      finishTurn,
      hasLost,
      hasRoomEnemy,
      isResolving,
      currentRoomId,
      playerEnergy,
      schedule,
      spendSpecialEnergy,
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

  function applyRecoveryItem({
    recover,
    startedRoomId,
  }: {
    recover: () => void;
    startedRoomId: string;
  }) {
    recover();
    setInventoryItem(null);
    finishPlayerAction({ startedRoomId });
  }

  function applyKeyItem(startedRoomId: string) {
    const lockedDirection = getLockedDirections(dungeonMap, currentRoomId)[0];

    if (!lockedDirection) {
      return;
    }

    const nextMap = commitMap((map) =>
      unlockDoor(map, currentRoomId, lockedDirection),
    );
    setInventoryItem(null);
    finishPlayerAction({ mapAtEnd: nextMap, startedRoomId });
  }

  function applySilverBullet(startedRoomId: string) {
    if (!currentMonster?.chases) {
      return;
    }

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

  async function activateInventoryItem() {
    if (isItemDisabled || !inventoryItem) {
      return;
    }

    const startedRoomId = currentRoomId;

    if (inventoryItem === "health-potion") {
      applyRecoveryItem({
        recover: () =>
          setPlayerHealth((health) =>
            recoverStat(health, PLAYER_MAX_HEALTH),
          ),
        startedRoomId,
      });
      return;
    }

    if (inventoryItem === "energy-meal") {
      applyRecoveryItem({
        recover: () =>
          setPlayerEnergy((energy) =>
            recoverStat(energy, PLAYER_MAX_ENERGY),
          ),
        startedRoomId,
      });
      return;
    }

    if (inventoryItem === "key") {
      applyKeyItem(startedRoomId);
      return;
    }

    applySilverBullet(startedRoomId);
  }

  async function pickupItem() {
    if (isResolving || hasLost || !currentRoomItem || !currentRoomItemObject) {
      return;
    }

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

    resetFeedback();
    void commitMap((map) => moveCurrentPosition(map, nextRoomId));
    setPlayerScenePosition(playerEntryPositions[direction]);

    if (checkRoomStairs(nextRoom)) {
      nextLevelStartingPositionRef.current = getGridPosition(nextRoomId);
    }

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
    inventoryItemSprite,
    isItemDisabled,
    isResolving,
    level,
    playerEnergy,
    playerEnergyLossAmount,
    playerHealth,
    playerHealthLossAmount,
    playerScenePosition,
    playerAction,
    expireTurn,
    isGameLoopRunning,
    isTurnClockActive,
    turnStatus,
    turnDuration,
    turnNumber,
    turnTimeRemaining,
    updateGameFrame,
  };
}
