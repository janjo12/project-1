import * as Haptics from "expo-haptics";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import {
  GameEngine,
  type GameEngineSystem,
  type GameEngineUpdateEventOptionType,
} from "react-native-game-engine";

import { ActionControls, type PlayerAction } from "@/components/action-controls";
import { DungeonMap } from "@/components/dungeon-map";
import { GameViewPanel, ResourceBar } from "@/components/game-view-panel";
import { PreferenceToggles } from "@/components/preference-toggles";
import { ScreenShell } from "@/components/screen-shell";
import { useThemeColors, type ThemeColors } from "@/components/theme";
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
  type WorldMonster
} from "@/utils/dungeon-map";
import type {
  Difficulty,
  GameSettings,
  Handedness,
} from "@/utils/settings-storage";

type GameScreenProps = {
  difficulty?: Difficulty;
  handedness: Handedness;
  onGameOver: (score: number) => void;
  onQuitToTitle?: () => void;
  onSettingsChange?: (settings: Partial<GameSettings>) => void;
  seed: string;
  settings?: Pick<GameSettings, "appearance" | "vibrationEnabled">;
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
const TURN_TIMEOUT_ACTION = "defend" satisfies PlayerAction;
const moveActionDirections = {
  "move-east": "east",
  "move-north": "north",
  "move-south": "south",
  "move-west": "west",
} satisfies Partial<Record<PlayerAction, Direction>>;

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

function createLevelMap(seed: string, level: number, startingPosition?: GridPosition) {
  return createSeededDungeonMap(seed, level, startingPosition);
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

  return Boolean(monster?.isWerewolf);
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

export function GameScreen({
  difficulty = "normal",
  handedness,
  onGameOver,
  onQuitToTitle = () => {},
  onSettingsChange = () => {},
  seed,
  settings,
  vibrationEnabled = true,
}: GameScreenProps) {
  const isLeftHanded = handedness === "left";
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const game = useGameRun({ difficulty, onGameOver, seed, vibrationEnabled });
  const pauseSettings = settings ?? {
    appearance: "system" as const,
    vibrationEnabled,
  };
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
        resetKey: game.turnNumber,
      },
    }),
    [
      game.expireTurn,
      game.isTurnClockActive,
      game.turnNumber,
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
          running={game.isGameLoopRunning() && !isMenuOpen}
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
            onPress={() => setIsMenuOpen(true)}
            style={({ pressed }) => [
              styles.menuButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.menuButtonText}>Menu</Text>
          </Pressable>
        </View>

        <GameViewPanel
          animationFrame={game.animationFrame}
          enemy={game.currentEnemy}
          enemyHealthLossAmount={game.enemyHealthLossAmount}
          enemyMaxHitPoints={game.currentEnemyMaxHitPoints}
          floorItem={game.currentRoomItem}
          floorStairs={game.roomHasStairs}
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
          <DungeonMap
            currentRoomId={game.currentRoomId}
            map={game.dungeonMap}
          />
          <ActionControls
            disabledActions={disabledActions}
            disabledDirections={game.disabledDirections}
            floorItemLabel={getItemLabel(game.currentRoomItem)}
            isItemDisabled={game.isItemDisabled}
            isBusy={game.isResolving}
            itemLabel={getItemLabel(game.inventoryItem)}
            nextLevelNumber={game.roomHasStairs ? game.level + 1 : null}
            playerAction={game.playerAction}
          />
        </View>

        <PauseMenu
          onBackToGame={() => setIsMenuOpen(false)}
          onQuitToTitle={confirmQuitToTitle}
          onSettingsChange={onSettingsChange}
          settings={pauseSettings}
          visible={isMenuOpen}
        />
      </View>
    </ScreenShell>
  );
}

type PauseMenuProps = {
  onBackToGame: () => void;
  onQuitToTitle: () => void;
  onSettingsChange: (settings: Partial<GameSettings>) => void;
  settings: Pick<GameSettings, "appearance" | "vibrationEnabled">;
  visible: boolean;
};

function PauseMenu({
  onBackToGame,
  onQuitToTitle,
  onSettingsChange,
  settings,
  visible,
}: PauseMenuProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <Modal
      animationType="fade"
      onRequestClose={onBackToGame}
      transparent
      visible={visible}
    >
      <View style={styles.pauseBackdrop}>
        <View accessibilityLabel="Game menu" style={styles.pausePanel}>
          <Text style={styles.pauseTitle}>Menu</Text>
          <PreferenceToggles
            onChange={onSettingsChange}
            settings={settings}
          />
          <View style={styles.pauseActions}>
            <PauseButton label="Back to Game" onPress={onBackToGame} />
            <PauseButton
              label="Quit to Title"
              onPress={onQuitToTitle}
              variant="danger"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

type PauseButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "danger" | "primary";
};

function PauseButton({
  label,
  onPress,
  variant = "primary",
}: PauseButtonProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.pauseButton,
        variant === "danger" && styles.pauseDangerButton,
        pressed && styles.pressed,
      ]}
    >
      <Text
        adjustsFontSizeToFit
        numberOfLines={1}
        style={[
          styles.pauseButtonText,
          variant === "danger" && styles.pauseDangerButtonText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function useGameRun({
  difficulty,
  onGameOver,
  seed,
  vibrationEnabled,
}: UseGameRunOptions) {
  const [level, setLevel] = useState(1);
  const [clearedLevels, setClearedLevels] = useState(0);
  const [stairRoomPosition, setStairRoomPosition] = useState<GridPosition | null>(null);
  const [dungeonMap, setDungeonMap] = useState(() => createLevelMap(seed, 1));
  const [inventoryItem, setInventoryItem] = useState<ItemId | null>(null);
  const timeoutIds = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearedLevelsRef = useRef(0);
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
  const currentRoomItem = getRoomItemId(currentRoom);
  const currentRoomItemObject = getRoomItem(currentRoom);
  const currentMonster = getRoomMonster(currentRoom);
  const hasLost = playerHealth <= 0;
  const hasTurnTimer = difficulty !== "easy";
  const roomHasStairs = currentRoom ? checkRoomStairs(currentRoom) : false;
  const currentEnemy = currentMonster
    ? {
        emoji: currentMonster.sprite,
        hitPoints: currentMonster.currentHealth,
        name: currentMonster.name,
      }
    : null;
  const currentEnemyMaxHitPoints = currentMonster?.maximumHealth ?? 1;
  const hasRoomEnemy = Boolean(currentMonster);
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

    void (async () => {
      const nextMap = await createAndSaveSeededDungeonMap(seed, level);

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
    (stairRoomPosition?: GridPosition) => {
      const nextClearedLevels = clearedLevelsRef.current + 1;
      const nextLevel = level + 1;
      const nextMap = createLevelMap(seed, nextLevel, stairRoomPosition);

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
    [
      finishTurn,
      onGameOver,
      schedule,
      triggerDamageHaptic,
    ],
  );

  const finishPlayerAction = useCallback(({
    isDefending = false,
    mapAtEnd,
    startedRoomId,
  }: {
    isDefending?: boolean;
    mapAtEnd?: DungeonMapType;
    startedRoomId: string;
  }) => {
    const roomAtEnd = getCurrentRoom(mapAtEnd ?? dungeonMap);
    const monsterAtEnd = getRoomMonster(roomAtEnd);

    if (roomAtEnd?.id === startedRoomId && monsterAtEnd) {
      setIsResolving(true);
      startEnemyMove(isDefending, monsterAtEnd.damage);
      return;
    }

    finishTurn();
  }, [dungeonMap, finishTurn, startEnemyMove]);

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

      const damage = currentMonster.isWerewolf
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

    if (currentMonster?.isWerewolf) {
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
      advanceToNextLevel(stairRoomPosition ?? undefined);
      setStairRoomPosition(null);
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
      setStairRoomPosition(stairPosition);
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
    currentRoomId,
    disabledDirections,
    dungeonMap,
    enemyHealthLossAmount,
    hasLost,
    hasRoomEnemy,
    roomHasStairs,
    hasTurnTimer,
    inventoryItem,
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
      fontSize: 16,
      fontWeight: "900",
      minHeight: 22,
      textAlign: "center",
    },
    menuButton: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: 36,
      paddingHorizontal: 10,
    },
    menuButtonText: {
      color: colors.ink,
      fontSize: 14,
      fontWeight: "900",
    },
    pauseActions: {
      gap: 10,
    },
    pauseBackdrop: {
      alignItems: "center",
      backgroundColor: "rgba(2, 6, 23, 0.62)",
      flex: 1,
      justifyContent: "center",
      padding: 22,
    },
    pauseButton: {
      alignItems: "center",
      backgroundColor: colors.ink,
      borderColor: colors.ink,
      borderRadius: 10,
      borderWidth: 2,
      justifyContent: "center",
      minHeight: 54,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    pauseButtonText: {
      color: colors.paper,
      fontSize: 22,
      fontWeight: "900",
      textAlign: "center",
    },
    pauseDangerButton: {
      backgroundColor: "transparent",
      borderColor: colors.health,
    },
    pauseDangerButtonText: {
      color: colors.health,
    },
    pausePanel: {
      backgroundColor: colors.paper,
      borderColor: colors.ink,
      borderRadius: 8,
      borderWidth: 3,
      gap: 28,
      maxWidth: 420,
      padding: 22,
      width: "100%",
    },
    pauseTitle: {
      color: colors.ink,
      fontSize: 34,
      fontWeight: "900",
      textAlign: "center",
    },
    pressed: {
      opacity: 0.72,
    },
  });
}
