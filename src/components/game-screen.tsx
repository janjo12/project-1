import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import {
  ActionControls,
  actionDetails,
  type PlayerAction,
} from "@/components/action-controls";
import { DungeonMapPlaceholder } from "@/components/dungeon-map-placeholder";
import {
  type Enemy,
  GameViewPanel,
  ResourceBar,
} from "@/components/game-view-panel";
import { ScreenShell } from "@/components/screen-shell";
import { type ThemeColors, useThemeColors } from "@/components/theme";
import type { Handedness } from "@/utils/settings-storage";

type GameScreenProps = {
  handedness: Handedness;
  onGameOver: (score: number) => void;
  onQuitToTitle?: () => void;
  seed: string;
  vibrationEnabled?: boolean;
};

type UseGameRunOptions = {
  onGameOver: (score: number) => void;
  seed: string;
  vibrationEnabled: boolean;
};

const PLAYER_STARTING_HEALTH = 10;
const PLAYER_STARTING_ENERGY = 6;
const ATTACK_DAMAGE = 1;
const ENEMY_DAMAGE = 1;
const TURN_DURATION = 4000;
const TURN_TIMER_TICK = 100;

const ENEMIES: Enemy[] = [
  { emoji: "\uD83D\uDC7E", hitPoints: 3, name: "Glitch Imp" },
  { emoji: "\uD83E\uDDDF", hitPoints: 3, name: "Crypt Stumbler" },
  { emoji: "\uD83D\uDC09", hitPoints: 3, name: "Tiny Dragon" },
  { emoji: "\uD83E\uDDDB", hitPoints: 3, name: "Night Count" },
];

function hashSeed(seed: string) {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createSeededRandom(seed: string) {
  let state = hashSeed(seed) || 1;

  return () => {
    state = Math.imul(state, 1664525) + 1013904223;
    return (state >>> 0) / 4294967296;
  };
}

export function getSeededEnemyRoster(seed: string) {
  const random = createSeededRandom(seed);
  const roster = [...ENEMIES];

  for (let index = roster.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [roster[index], roster[swapIndex]] = [roster[swapIndex], roster[index]];
  }

  return roster;
}

export function GameScreen({
  handedness,
  onGameOver,
  onQuitToTitle = () => {},
  seed,
  vibrationEnabled = true,
}: GameScreenProps) {
  const isLeftHanded = handedness === "left";
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const game = useGameRun({ onGameOver, seed, vibrationEnabled });
  const disabledActions = getDisabledActions({
    hasLost: game.hasLost,
    playerEnergy: game.playerEnergy,
  });

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
          enemy={{
            ...game.currentEnemy,
            hitPoints: game.enemyHitPoints,
          }}
          enemyHealthLossAmount={game.enemyHealthLossAmount}
          enemyHealthLossSignal={game.enemyDamageSignal}
          enemyMaxHitPoints={game.currentEnemy.hitPoints}
          enemyRoster={game.enemies}
          enemyAttackSignal={game.enemyAttackSignal}
          monsterDamageSignal={game.enemyDamageSignal}
          playerAttackSignal={game.playerAttackSignal}
          playerDamageSignal={game.playerDamageSignal}
          playerEnergyLossAmount={game.playerEnergyLossAmount}
          playerEnergyLossSignal={game.playerEnergyLossSignal}
          playerHealthLossAmount={game.playerHealthLossAmount}
          playerHealthLossSignal={game.playerDamageSignal}
        />

        <View style={styles.playerBars}>
          <ResourceBar
            accessibilityLabel="Player health"
            color={colors.health}
            current={game.playerHealth}
            icon="heart"
            max={PLAYER_STARTING_HEALTH}
            testID="player-health-bar"
          />
          <ResourceBar
            accessibilityLabel="Player energy"
            color={colors.energy}
            current={game.playerEnergy}
            icon="bolt"
            max={PLAYER_STARTING_ENERGY}
            testID="player-energy-bar"
          />
        </View>

        <TurnTimerBar progress={game.turnProgress} />

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
          <DungeonMapPlaceholder />
          <ActionControls
            disabledActions={disabledActions}
            isBusy={game.isResolving}
            onAction={game.selectAction}
            onConfirmAction={game.confirmSelectedAction}
            selectedAction={game.selectedAction}
          />
        </View>
      </View>
    </ScreenShell>
  );
}

function useGameRun({
  onGameOver,
  seed,
  vibrationEnabled,
}: UseGameRunOptions) {
  const enemies = useMemo(() => getSeededEnemyRoster(seed), [seed]);
  const timeoutIds = useRef<ReturnType<typeof setTimeout>[]>([]);
  const selectedActionRef = useRef<PlayerAction | null>(null);
  const defeatedEnemiesRef = useRef(0);
  const [enemyIndex, setEnemyIndex] = useState(0);
  const [defeatedEnemies, setDefeatedEnemies] = useState(0);
  const [enemyHitPoints, setEnemyHitPoints] = useState(enemies[0].hitPoints);
  const [enemyAttackSignal, setEnemyAttackSignal] = useState(0);
  const [enemyDamageSignal, setEnemyDamageSignal] = useState(0);
  const [enemyHealthLossAmount, setEnemyHealthLossAmount] = useState(0);
  const [isResolving, setIsResolving] = useState(false);
  const [playerAttackSignal, setPlayerAttackSignal] = useState(0);
  const [playerDamageSignal, setPlayerDamageSignal] = useState(0);
  const [playerEnergy, setPlayerEnergy] = useState(PLAYER_STARTING_ENERGY);
  const [playerEnergyLossAmount, setPlayerEnergyLossAmount] = useState(0);
  const [playerEnergyLossSignal, setPlayerEnergyLossSignal] = useState(0);
  const [playerHealth, setPlayerHealth] = useState(PLAYER_STARTING_HEALTH);
  const [playerHealthLossAmount, setPlayerHealthLossAmount] = useState(0);
  const [selectedAction, setSelectedAction] = useState<PlayerAction | null>(
    null,
  );
  const [turnNumber, setTurnNumber] = useState(0);
  const [turnTimeRemaining, setTurnTimeRemaining] = useState(TURN_DURATION);

  const hasLost = playerHealth <= 0;
  const currentEnemy = enemies[enemyIndex];
  const turnProgress = turnTimeRemaining / TURN_DURATION;
  const turnStatus = getTurnStatus({
    currentEnemyName: currentEnemy.name,
    defeatedEnemies,
    hasLost,
    isResolving,
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

  const finishTurn = useCallback(() => {
    selectedActionRef.current = null;
    setSelectedAction(null);
    setTurnTimeRemaining(TURN_DURATION);
    setIsResolving(false);
    setTurnNumber((number) => number + 1);
  }, []);

  const startEnemyMove = useCallback(
    (isDefending: boolean) => {
      setEnemyAttackSignal((signal) => signal + 1);

      if (!isDefending) {
        schedule(250, () => {
          setPlayerHealthLossAmount(ENEMY_DAMAGE);
          setPlayerDamageSignal((signal) => signal + 1);
          triggerDamageHaptic();
        });
      }

      schedule(500, () => {
        if (!isDefending) {
          setPlayerHealth((health) => {
            const nextHealth = Math.max(0, health - ENEMY_DAMAGE);

            if (nextHealth <= 0) {
              schedule(0, () => onGameOver(defeatedEnemiesRef.current));
            }

            return nextHealth;
          });
        }

        finishTurn();
      });
    },
    [finishTurn, onGameOver, schedule, triggerDamageHaptic],
  );

  const resolveTurn = useCallback(
    (action: PlayerAction) => {
      if (isResolving || hasLost) {
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

      const damage = action === "special" ? ATTACK_DAMAGE * 2 : ATTACK_DAMAGE;
      const healthLost = Math.min(enemyHitPoints, damage);
      const nextEnemyHealth = Math.max(0, enemyHitPoints - damage);

      if (action === "special") {
        setPlayerEnergyLossAmount(1);
        setPlayerEnergyLossSignal((signal) => signal + 1);
        setPlayerEnergy((energy) => Math.max(0, energy - 1));
      }

      setPlayerAttackSignal((signal) => signal + 1);

      schedule(250, () => {
        setEnemyHealthLossAmount(healthLost);
        setEnemyDamageSignal((signal) => signal + 1);
      });

      schedule(500, () => {
        setEnemyHitPoints(nextEnemyHealth);

        if (nextEnemyHealth <= 0) {
          const nextDefeatedEnemies = defeatedEnemiesRef.current + 1;
          defeatedEnemiesRef.current = nextDefeatedEnemies;
          setDefeatedEnemies(nextDefeatedEnemies);
          const nextEnemyIndex = (enemyIndex + 1) % enemies.length;
          setEnemyIndex(nextEnemyIndex);
          setEnemyHitPoints(enemies[nextEnemyIndex].hitPoints);
          finishTurn();
          return;
        }

        startEnemyMove(false);
      });
    },
    [
      enemies,
      enemyHitPoints,
      enemyIndex,
      finishTurn,
      hasLost,
      isResolving,
      playerEnergy,
      schedule,
      startEnemyMove,
    ],
  );

  useEffect(() => {
    if (hasLost || isResolving) {
      return;
    }

    const intervalId = setInterval(() => {
      setTurnTimeRemaining((remaining) =>
        Math.max(0, remaining - TURN_TIMER_TICK),
      );
    }, TURN_TIMER_TICK);
    const timeoutId = setTimeout(() => {
      resolveTurn(selectedActionRef.current ?? "defend");
    }, TURN_DURATION);

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [hasLost, isResolving, resolveTurn, turnNumber]);

  function selectAction(action: PlayerAction) {
    if (isResolving || hasLost) {
      return;
    }

    if (action === "special" && playerEnergy <= 0) {
      return;
    }

    selectedActionRef.current = action;
    setSelectedAction(action);
  }

  function confirmSelectedAction() {
    if (!selectedAction || isResolving || hasLost) {
      return;
    }

    resolveTurn(selectedAction);
  }

  return {
    confirmSelectedAction,
    currentEnemy,
    enemies,
    enemyAttackSignal,
    enemyDamageSignal,
    enemyHealthLossAmount,
    enemyHitPoints,
    hasLost,
    isResolving,
    playerAttackSignal,
    playerDamageSignal,
    playerEnergy,
    playerEnergyLossAmount,
    playerEnergyLossSignal,
    playerHealth,
    playerHealthLossAmount,
    selectAction,
    selectedAction,
    turnProgress,
    turnStatus,
  };
}

function getDisabledActions({
  hasLost,
  playerEnergy,
}: {
  hasLost: boolean;
  playerEnergy: number;
}) {
  if (hasLost) {
    return ["attack", "defend", "special"] satisfies PlayerAction[];
  }

  if (playerEnergy <= 0) {
    return ["special"] satisfies PlayerAction[];
  }

  return [] satisfies PlayerAction[];
}

function getTurnStatus({
  currentEnemyName,
  defeatedEnemies,
  hasLost,
  isResolving,
  selectedAction,
}: {
  currentEnemyName: string;
  defeatedEnemies: number;
  hasLost: boolean;
  isResolving: boolean;
  selectedAction: PlayerAction | null;
}) {
  if (hasLost) {
    return "You fell!";
  }

  if (isResolving) {
    return "Resolving turn...";
  }

  if (selectedAction) {
    return `${actionDetails[selectedAction].label} selected | Defeated ${defeatedEnemies}`;
  }

  return `Facing ${currentEnemyName} | Defeated ${defeatedEnemies}`;
}

function TurnTimerBar({ progress }: { progress: number }) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const fillPercent = `${Math.max(0, Math.min(100, progress * 100))}%`;

  return (
    <View
      accessibilityLabel="Turn timer"
      style={styles.turnTimerTrack}
      testID="turn-timer"
    >
      <View
        style={[styles.turnTimerFill, { width: fillPercent }]}
        testID="turn-timer-fill"
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      gap: 10,
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
    turnTimerTrack: {
      alignItems: "center",
      backgroundColor: colors.paperLight,
      borderRadius: 999,
      height: 10,
      overflow: "hidden",
      width: "100%",
    },
    turnTimerFill: {
      backgroundColor: "#a855f7",
      borderRadius: 999,
      height: "100%",
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
