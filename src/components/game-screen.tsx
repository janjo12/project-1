import * as Haptics from "expo-haptics";
import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import {
  GameEngine,
  type GameEngineSystem,
  type GameEngineUpdateEventOptionType,
} from "react-native-game-engine";

import {
  ActionControls,
  actionDetails,
  type PlayerAction,
} from "@/components/action-controls";
import { DungeonMapPlaceholder } from "@/components/dungeon-map-placeholder";
import { GameViewPanel, ResourceBar } from "@/components/game-view-panel";
import { ScreenShell } from "@/components/screen-shell";
import { type ThemeColors, useThemeColors } from "@/components/theme";
import {
  advanceAnimationFrame,
  COMBAT,
  createCombatAnimationFrame,
  getSeededEnemyRoster,
  ITEMS,
  PLAYER,
  WEREWOLF,
  type CombatAnimationFrame,
  type Enemy,
} from "@/entities";
import {
  createSeededDungeonMap,
  getConnectedRoomId,
  getLockedDirections,
  getRoom,
  getRoomEnemyIndex,
  getRoomItemId,
  unlockDoor,
  type Direction,
  type DungeonMap,
  type ItemId,
} from "@/utils/dungeon-map";
import type { Difficulty, Handedness } from "@/utils/settings-storage";

type GameScreenProps = {
  difficulty?: Difficulty;
  handedness: Handedness;
  onGameOver: (score: number) => void;
  onQuitToTitle?: () => void;
  seed: string;
  vibrationEnabled?: boolean;
};

type UseGameRunOptions = {
  difficulty: Difficulty;
  onGameOver: (score: number) => void;
  seed: string;
  vibrationEnabled: boolean;
};

const PLAYER_MAX_HEALTH = PLAYER.maxHealth;
const PLAYER_MAX_ENERGY = PLAYER.maxEnergy;
const TURN_DURATION = 4000;
const GAME_LOOP_TICK = 100;

type GameLoopEntity = {
  elapsed: number;
  expired: boolean;
  isTurnClockActive: () => boolean;
  onExpire: () => void;
  onFrame: (delta: number, turnTimeRemaining?: number) => void;
};

type GameLoopEntities = {
  gameLoop: GameLoopEntity;
};

class GameLoopTimer {
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

const runGameLoop: GameEngineSystem = (
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

function createLevelMap(seed: string, level: number, enemyCount: number) {
  return createSeededDungeonMap(seed, level, enemyCount);
}

function markRoomCleared(map: DungeonMap, roomId: string): DungeonMap {
  return setRoomContents(map, roomId, "empty");
}

function setRoomContents(
  map: DungeonMap,
  roomId: string,
  contents: DungeonMap["rooms"][number][number]["contents"],
): DungeonMap {
  return {
    ...map,
    rooms: map.rooms.map((row) =>
      row.map((room) =>
        room.id === roomId
          ? {
              ...room,
              contents,
            }
          : room,
      ),
    ),
  };
}

function getDisabledDirections({
  dungeonMap,
  isResolving,
  roomId,
}: {
  dungeonMap: DungeonMap;
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

function getRoomEnemyHitPoints(
  map: DungeonMap,
  roomId: string,
  enemies: Enemy[],
) {
  const room = getRoom(map, roomId);
  const enemyIndex = getRoomEnemyIndex(room);

  if (enemyIndex === null) {
    return 0;
  }

  return enemies[enemyIndex % enemies.length].hitPoints;
}

function canUseInventoryItem({
  currentRoomId,
  dungeonMap,
  hasWerewolfInRoom,
  inventoryItem,
  playerEnergy,
  playerHealth,
}: {
  currentRoomId: string;
  dungeonMap: DungeonMap;
  hasWerewolfInRoom: boolean;
  inventoryItem: ItemId | null;
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

  return hasWerewolfInRoom;
}

function resetRoomFeedback({
  setEnemyHealthLossAmount,
  setPlayerEnergyLossAmount,
  setPlayerHealthLossAmount,
  setSelectedAction,
  selectedActionRef,
}: {
  selectedActionRef: RefObject<PlayerAction | null>;
  setEnemyHealthLossAmount: Dispatch<SetStateAction<number>>;
  setPlayerEnergyLossAmount: Dispatch<SetStateAction<number>>;
  setPlayerHealthLossAmount: Dispatch<SetStateAction<number>>;
  setSelectedAction: Dispatch<SetStateAction<PlayerAction | null>>;
}) {
  setEnemyHealthLossAmount(0);
  setPlayerEnergyLossAmount(0);
  setPlayerHealthLossAmount(0);
  selectedActionRef.current = null;
  setSelectedAction(null);
}

export function GameScreen({
  difficulty = "normal",
  handedness,
  onGameOver,
  onQuitToTitle = () => {},
  seed,
  vibrationEnabled = true,
}: GameScreenProps) {
  const isLeftHanded = handedness === "left";
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const game = useGameRun({ difficulty, onGameOver, seed, vibrationEnabled });
  const disabledActions = getDisabledActions({
    hasLost: game.hasLost,
    hasRoomEnemy: game.hasRoomEnemy,
    playerEnergy: game.playerEnergy,
  });
  const gameLoopEntities = useMemo(
    () => ({
      gameLoop: {
        elapsed: 0,
        expired: false,
        isTurnClockActive: game.isTurnClockActive,
        onExpire: game.expireTurn,
        onFrame: game.updateGameFrame,
      },
    }),
    [
      game.expireTurn,
      game.isTurnClockActive,
      game.updateGameFrame,
    ],
  );

  function confirmQuitToTitle() {
    Alert.alert("Quit to Title?", "Your current run will be lost.", [
      { style: "cancel", text: "Cancel" },
      {
        onPress: onQuitToTitle,
        style: "destructive",
        text: "Quit",
      },
    ]);
  }

  return (
    <ScreenShell compact>
      <View style={styles.container}>
        <GameEngine
          key={game.turnNumber}
          entities={gameLoopEntities}
          renderer={() => null}
          running={game.isGameLoopRunning()}
          style={styles.engineLoop}
          systems={[runGameLoop]}
          timer={new GameLoopTimer()}
        />

        <View
          style={[styles.header, isLeftHanded && styles.headerMirrored]}
          testID="game-header"
        >
          <Pressable
            accessibilityRole="button"
            onPress={confirmQuitToTitle}
            style={({ pressed }) => [
              styles.quitButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.quitButtonText}>Quit to Title</Text>
          </Pressable>
        </View>

        <GameViewPanel
          animationFrame={game.animationFrame}
          enemy={{
            ...game.currentEnemy,
            hitPoints: game.enemyHitPoints,
          }}
          enemyHealthLossAmount={game.enemyHealthLossAmount}
          enemyMaxHitPoints={game.currentEnemy.hitPoints}
          enemyRoster={game.enemyRoster}
          playerEnergyLossAmount={game.playerEnergyLossAmount}
          playerHealthLossAmount={game.playerHealthLossAmount}
        />

        <View style={styles.playerBars}>
          <ResourceBar
            accessibilityLabel="Player health"
            color={colors.health}
            current={game.playerHealth}
            icon="heart"
            max={PLAYER_MAX_HEALTH}
            panelPosition="first"
            testID="player-health-bar"
          />
          <ResourceBar
            accessibilityLabel="Player energy"
            color={colors.energy}
            current={game.playerEnergy}
            icon="bolt"
            max={PLAYER_MAX_ENERGY}
            panelPosition={game.hasTurnTimer ? "middle" : "last"}
            testID="player-energy-bar"
          />
          {game.hasTurnTimer ? (
            <ResourceBar
              accessibilityLabel="Turn timer"
              color="#a855f7"
              current={game.turnTimeRemaining}
              icon="hourglass-half"
              max={TURN_DURATION}
              panelPosition="last"
              testID="turn-timer"
            />
          ) : null}
        </View>

        <Text accessibilityLabel="Turn status" style={styles.turnStatus}>
          {game.turnStatus}
        </Text>

        <View
          style={[
            styles.lowerLayout,
            isLeftHanded && styles.lowerLayoutMirrored,
          ]}
          testID="game-lower-layout"
        >
          <DungeonMapPlaceholder
            currentRoomId={game.currentRoomId}
            map={game.dungeonMap}
            werewolfRoomId={game.werewolfRoomId ?? undefined}
          />
          <ActionControls
            disabledActions={disabledActions}
            disabledDirections={game.disabledDirections}
            floorItemLabel={
              game.currentRoomItem ? ITEMS[game.currentRoomItem].label : null
            }
            isItemDisabled={game.isItemDisabled}
            isBusy={game.isResolving}
            itemLabel={game.inventoryItem ? ITEMS[game.inventoryItem].label : null}
            onAction={game.selectAction}
            onMove={game.moveToRoom}
            onPickupItem={game.pickupItem}
            onUseItem={game.useItem}
          />
        </View>
      </View>
    </ScreenShell>
  );
}

function useGameRun({
  difficulty,
  onGameOver,
  seed,
  vibrationEnabled,
}: UseGameRunOptions) {
  const enemies = useMemo(() => getSeededEnemyRoster(seed), [seed]);
  const [level, setLevel] = useState(1);
  const [clearedLevels, setClearedLevels] = useState(0);
  const [dungeonMap, setDungeonMap] = useState(() =>
    createLevelMap(seed, 1, enemies.length),
  );
  const [currentRoomId, setCurrentRoomId] = useState(
    dungeonMap.startingRoomId,
  );
  const [inventoryItem, setInventoryItem] = useState<ItemId | null>(null);
  const [werewolfRoomId, setWerewolfRoomId] = useState(dungeonMap.werewolfRoomId);
  const [werewolfHitPoints, setWerewolfHitPoints] = useState(WEREWOLF.hitPoints);
  const [hasWerewolfEncountered, setHasWerewolfEncountered] = useState(false);
  const timeoutIds = useRef<ReturnType<typeof setTimeout>[]>([]);
  const selectedActionRef = useRef<PlayerAction | null>(null);
  const clearedLevelsRef = useRef(0);
  const [animationFrame, setAnimationFrame] =
    useState<CombatAnimationFrame>(createCombatAnimationFrame);
  const currentRoom = getRoom(dungeonMap, currentRoomId);
  const currentRoomItem = getRoomItemId(currentRoom);
  const currentRoomEnemyIndex = getRoomEnemyIndex(currentRoom);
  const hasWerewolfInRoom =
    werewolfHitPoints > 0 && werewolfRoomId === currentRoomId;
  const hasRoomEnemy = hasWerewolfInRoom || currentRoomEnemyIndex !== null;
  const [enemyHitPoints, setEnemyHitPoints] = useState(() =>
    getRoomEnemyHitPoints(dungeonMap, dungeonMap.startingRoomId, enemies),
  );
  const [enemyHealthLossAmount, setEnemyHealthLossAmount] = useState(0);
  const [isResolving, setIsResolving] = useState(false);
  const [playerEnergy, setPlayerEnergy] = useState(PLAYER_MAX_ENERGY);
  const [playerEnergyLossAmount, setPlayerEnergyLossAmount] = useState(0);
  const [playerHealth, setPlayerHealth] = useState(PLAYER_MAX_HEALTH);
  const [playerHealthLossAmount, setPlayerHealthLossAmount] = useState(0);
  const [selectedAction, setSelectedAction] = useState<PlayerAction | null>(
    null,
  );
  const [turnNumber, setTurnNumber] = useState(0);
  const [turnTimeRemaining, setTurnTimeRemaining] = useState(TURN_DURATION);

  const hasLost = playerHealth <= 0;
  const hasTurnTimer = difficulty !== "easy";
  const currentEnemy = hasWerewolfInRoom
    ? WEREWOLF
    : currentRoomEnemyIndex === null
      ? enemies[0]
      : enemies[currentRoomEnemyIndex % enemies.length];
  const enemyRoster = useMemo(() => [...enemies, WEREWOLF], [enemies]);
  const isItemDisabled =
    isResolving ||
    hasLost ||
    !canUseInventoryItem({
      currentRoomId,
      dungeonMap,
      hasWerewolfInRoom,
      inventoryItem,
      playerEnergy,
      playerHealth,
    });
  const disabledDirections = getDisabledDirections({
    dungeonMap,
    isResolving,
    roomId: currentRoomId,
  });
  const turnStatus = getTurnStatus({
    currentEnemyName: currentEnemy.name,
    hasRoomEnemy,
    hasLost,
    isResolving,
    level,
    roomId: currentRoomId,
    clearedLevels,
    selectedAction,
  });

  useEffect(() => {
    const scheduledTimeoutIds = timeoutIds.current;

    return () => {
      scheduledTimeoutIds.forEach(clearTimeout);
    };
  }, []);

  const schedule = useCallback((delay: number, callback: () => void) => {
    const timeoutId = setTimeout(callback, delay);
    timeoutIds.current.push(timeoutId);
  }, []);

  const triggerDamageHaptic = useCallback(() => {
    if (!vibrationEnabled) {
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [vibrationEnabled]);

  const advanceToNextLevel = useCallback(() => {
    const nextClearedLevels = clearedLevelsRef.current + 1;
    const nextLevel = level + 1;
    const nextMap = createLevelMap(seed, nextLevel, enemies.length);

    clearedLevelsRef.current = nextClearedLevels;
    setClearedLevels(nextClearedLevels);
    setLevel(nextLevel);
    setDungeonMap(nextMap);
    setCurrentRoomId(nextMap.startingRoomId);
    setWerewolfRoomId(nextMap.werewolfRoomId);
    setWerewolfHitPoints(WEREWOLF.hitPoints);
    setHasWerewolfEncountered(false);
    setEnemyHitPoints(
      getRoomEnemyHitPoints(nextMap, nextMap.startingRoomId, enemies),
    );
    resetRoomFeedback({
      selectedActionRef,
      setEnemyHealthLossAmount,
      setPlayerEnergyLossAmount,
      setPlayerHealthLossAmount,
      setSelectedAction,
    });
    setPlayerHealth(PLAYER_MAX_HEALTH);
    setPlayerEnergy(PLAYER_MAX_ENERGY);
    setTurnTimeRemaining(TURN_DURATION);
  }, [enemies, level, seed]);

  const finishTurn = useCallback(() => {
    selectedActionRef.current = null;
    setSelectedAction(null);
    setTurnTimeRemaining(TURN_DURATION);
    setIsResolving(false);
    setTurnNumber((number) => number + 1);
  }, []);

  const startEnemyMove = useCallback(
    (isDefending: boolean) => {
      restartAnimations(setAnimationFrame, ["enemyAttackElapsed"]);

      if (!isDefending) {
        schedule(250, () => {
          setPlayerHealthLossAmount(COMBAT.enemyDamage);
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
            const nextHealth = Math.max(0, health - COMBAT.enemyDamage);

            if (nextHealth <= 0) {
              schedule(0, () => onGameOver(clearedLevelsRef.current));
            }

            return nextHealth;
          });
        }

        finishTurn();
      });
    },
    [
      finishTurn,
      onGameOver,
      schedule,
      triggerDamageHaptic,
    ],
  );

  const resolveTurn = useCallback(
    (action: PlayerAction) => {
      if (isResolving || hasLost) {
        return;
      }

      if (!hasRoomEnemy) {
        selectedActionRef.current = null;
        setSelectedAction(null);
        return;
      }

      if (action === "special" && playerEnergy <= 0) {
        selectedActionRef.current = null;
        setSelectedAction(null);
        return;
      }

      selectedActionRef.current = null;
      setSelectedAction(null);
      setTurnTimeRemaining(0);
      setIsResolving(true);

      if (action === "defend") {
        schedule(150, () => startEnemyMove(true));
        return;
      }

      const damage = hasWerewolfInRoom
        ? 0
        : action === "special"
          ? COMBAT.attackDamage * 2
          : COMBAT.attackDamage;
      const healthLost = Math.min(enemyHitPoints, damage);
      const nextEnemyHealth = Math.max(0, enemyHitPoints - damage);

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
        setEnemyHitPoints(nextEnemyHealth);
        if (hasWerewolfInRoom) {
          setWerewolfHitPoints(nextEnemyHealth);
        }

        if (nextEnemyHealth <= 0) {
          if (hasWerewolfInRoom) {
            setWerewolfHitPoints(0);
            setEnemyHitPoints(
              getRoomEnemyHitPoints(dungeonMap, currentRoomId, enemies),
            );
          } else {
            setDungeonMap((map) => markRoomCleared(map, currentRoomId));
            setEnemyHitPoints(0);
          }

          finishTurn();
          return;
        }

        startEnemyMove(false);
      });
    },
    [
      enemyHitPoints,
      finishTurn,
      hasLost,
      hasRoomEnemy,
      hasWerewolfInRoom,
      isResolving,
      currentRoomId,
      dungeonMap,
      enemies,
      playerEnergy,
      schedule,
      startEnemyMove,
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
    resolveTurn(selectedActionRef.current ?? "defend");
  }, [resolveTurn]);

  function useItem() {
    if (isItemDisabled || !inventoryItem) {
      return;
    }

    if (inventoryItem === "health-potion") {
      setPlayerHealth((health) =>
        Math.min(PLAYER_MAX_HEALTH, health + PLAYER_MAX_HEALTH / 2),
      );
      setInventoryItem(null);
      return;
    }

    if (inventoryItem === "energy-meal") {
      setPlayerEnergy((energy) =>
        Math.min(PLAYER_MAX_ENERGY, energy + PLAYER_MAX_ENERGY / 2),
      );
      setInventoryItem(null);
      return;
    }

    if (inventoryItem === "key") {
      const lockedDirection = getLockedDirections(dungeonMap, currentRoomId)[0];

      if (!lockedDirection) {
        return;
      }

      setDungeonMap((map) => unlockDoor(map, currentRoomId, lockedDirection));
      setInventoryItem(null);
      return;
    }

    if (hasWerewolfInRoom) {
      setWerewolfHitPoints(0);
      setInventoryItem(null);
      setEnemyHealthLossAmount(WEREWOLF.hitPoints);
      restartAnimations(setAnimationFrame, [
        "enemyDamageElapsed",
        "enemyHealthLossElapsed",
      ]);
      setEnemyHitPoints(getRoomEnemyHitPoints(dungeonMap, currentRoomId, enemies));
      triggerDamageHaptic();
    }
  }

  function pickupItem() {
    if (isResolving || hasLost || !currentRoomItem) {
      return;
    }

    const nextInventoryItem = currentRoomItem;
    const nextRoomContents = inventoryItem ? (`item-${inventoryItem}` as const) : "empty";

    setDungeonMap((map) => setRoomContents(map, currentRoomId, nextRoomContents));
    setInventoryItem(nextInventoryItem);
  }

  function selectAction(action: PlayerAction) {
    if (isResolving || hasLost || !hasRoomEnemy) {
      return;
    }

    if (action === "special" && playerEnergy <= 0) {
      return;
    }

    resolveTurn(action);
  }

  function moveToRoom(direction: Direction) {
    if (isResolving || hasLost) {
      return;
    }

    const nextRoomId = getConnectedRoomId(dungeonMap, currentRoomId, direction);

    if (!nextRoomId) {
      return;
    }

    const nextRoom = getRoom(dungeonMap, nextRoomId);

    if (nextRoom?.contents === "stairs") {
      advanceToNextLevel();
      return;
    }

    selectedActionRef.current = null;
    resetRoomFeedback({
      selectedActionRef,
      setEnemyHealthLossAmount,
      setPlayerEnergyLossAmount,
      setPlayerHealthLossAmount,
      setSelectedAction,
    });
    const nextWerewolfRoomId =
      hasWerewolfEncountered && werewolfHitPoints > 0
        ? nextRoomId
        : werewolfRoomId;
    const nextHasWerewolf =
      werewolfHitPoints > 0 && nextWerewolfRoomId === nextRoomId;

    if (nextHasWerewolf) {
      setHasWerewolfEncountered(true);
    }

    setWerewolfRoomId(nextWerewolfRoomId);
    setEnemyHitPoints(
      nextHasWerewolf
        ? werewolfHitPoints
        : getRoomEnemyHitPoints(dungeonMap, nextRoomId, enemies),
    );
    setCurrentRoomId(nextRoomId);
  }

  return {
    animationFrame,
    currentEnemy,
    currentRoomItem,
    currentRoomId,
    disabledDirections,
    dungeonMap,
    enemies,
    enemyRoster,
    enemyHealthLossAmount,
    enemyHitPoints,
    hasLost,
    hasRoomEnemy,
    hasWerewolfInRoom,
    hasTurnTimer,
    inventoryItem,
    isItemDisabled,
    isResolving,
    playerEnergy,
    playerEnergyLossAmount,
    playerHealth,
    playerHealthLossAmount,
    moveToRoom,
    pickupItem,
    selectAction,
    selectedAction,
    expireTurn,
    isGameLoopRunning,
    isTurnClockActive,
    turnStatus,
    turnNumber,
    turnTimeRemaining,
    updateGameFrame,
    useItem,
    werewolfRoomId,
  };
}

function getDisabledActions({
  hasLost,
  hasRoomEnemy,
  playerEnergy,
}: {
  hasLost: boolean;
  hasRoomEnemy: boolean;
  playerEnergy: number;
}) {
  if (hasLost || !hasRoomEnemy) {
    return ["attack", "defend", "special"] satisfies PlayerAction[];
  }

  if (playerEnergy <= 0) {
    return ["special"] satisfies PlayerAction[];
  }

  return [] satisfies PlayerAction[];
}

function getTurnStatus({
  currentEnemyName,
  clearedLevels,
  hasRoomEnemy,
  hasLost,
  isResolving,
  level,
  roomId,
  selectedAction,
}: {
  currentEnemyName: string;
  clearedLevels: number;
  hasRoomEnemy: boolean;
  hasLost: boolean;
  isResolving: boolean;
  level: number;
  roomId: string;
  selectedAction: PlayerAction | null;
}) {
  if (hasLost) {
    return "You fell!";
  }

  if (isResolving) {
    return "Resolving turn...";
  }

  if (selectedAction) {
    return `${actionDetails[selectedAction].label} selected | Level ${level}`;
  }

  if (!hasRoomEnemy) {
    return `Room ${roomId} clear | Level ${level} | Cleared ${clearedLevels}`;
  }

  return `Facing ${currentEnemyName} | Level ${level} | Room ${roomId}`;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      gap: 10,
    },
    engineLoop: {
      height: 0,
      opacity: 0,
      width: 0,
    },
    header: {
      flexDirection: "row",
      justifyContent: "flex-start",
      minHeight: 46,
      paddingTop: 18,
    },
    headerMirrored: {
      justifyContent: "flex-end",
    },
    lowerLayout: {
      alignItems: "flex-end",
      flex: 1,
      flexDirection: "row",
      gap: 14,
      justifyContent: "space-between",
      paddingBottom: 120,
    },
    lowerLayoutMirrored: {
      flexDirection: "row-reverse",
    },
    playerBars: {
      gap: 6,
    },
    turnStatus: {
      color: colors.fadedInk,
      fontSize: 14,
      fontWeight: "700",
      minHeight: 20,
      textAlign: "center",
    },
    quitButton: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: 36,
      paddingHorizontal: 10,
    },
    quitButtonText: {
      color: colors.ink,
      fontSize: 13,
      fontWeight: "700",
    },
    pressed: {
      opacity: 0.72,
    },
  });
}
