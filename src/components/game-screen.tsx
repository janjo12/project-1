import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import {
  ActionControls,
  type PlayerAction,
} from "@/components/action-controls";
import { DungeonMapPlaceholder } from "@/components/dungeon-map-placeholder";
import { type Enemy, GameViewPanel } from "@/components/game-view-panel";
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

const PLAYER_STARTING_HEALTH = 10;
const PLAYER_STARTING_ENERGY = 6;
const ATTACK_DAMAGE = 1;
const ENEMY_DAMAGE = 1;

const ENEMIES: Enemy[] = [
  { emoji: "👾", hitPoints: 3, name: "Glitch Imp" },
  { emoji: "🧟", hitPoints: 3, name: "Crypt Stumbler" },
  { emoji: "🐉", hitPoints: 3, name: "Tiny Dragon" },
  { emoji: "🧛", hitPoints: 3, name: "Night Count" },
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
  const enemies = useMemo(() => getSeededEnemyRoster(seed), [seed]);
  const timeoutIds = useRef<ReturnType<typeof setTimeout>[]>([]);
  const defeatedEnemiesRef = useRef(0);
  const [enemyIndex, setEnemyIndex] = useState(0);
  const [defeatedEnemies, setDefeatedEnemies] = useState(0);
  const [enemyHitPoints, setEnemyHitPoints] = useState(enemies[0].hitPoints);
  const [enemyAttackSignal, setEnemyAttackSignal] = useState(0);
  const [enemyDamageSignal, setEnemyDamageSignal] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [playerAttackSignal, setPlayerAttackSignal] = useState(0);
  const [playerDamageSignal, setPlayerDamageSignal] = useState(0);
  const [playerEnergy, setPlayerEnergy] = useState(PLAYER_STARTING_ENERGY);
  const [playerHealth, setPlayerHealth] = useState(PLAYER_STARTING_HEALTH);

  const hasLost = playerHealth <= 0;
  const currentEnemy = enemies[enemyIndex];

  useEffect(() => {
    const scheduledTimeoutIds = timeoutIds.current;

    return () => {
      scheduledTimeoutIds.forEach(clearTimeout);
    };
  }, []);

  function schedule(delay: number, callback: () => void) {
    const timeoutId = setTimeout(callback, delay);
    timeoutIds.current.push(timeoutId);
  }

  function finishTurn() {
    setIsAnimating(false);
  }

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

  function triggerDamageHaptic() {
    if (!vibrationEnabled) {
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  function startEnemyMove(isDefending: boolean) {
    setEnemyAttackSignal((signal) => signal + 1);

    if (!isDefending) {
      schedule(250, () => {
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
  }

  function handleAction(action: PlayerAction) {
    if (isAnimating || hasLost) {
      return;
    }

    if (action === "special" && playerEnergy <= 0) {
      return;
    }

    setIsAnimating(true);

    if (action === "defend") {
      schedule(150, () => startEnemyMove(true));
      return;
    }

    const damage = action === "special" ? ATTACK_DAMAGE * 2 : ATTACK_DAMAGE;
    const nextEnemyHealth = Math.max(0, enemyHitPoints - damage);

    if (action === "special") {
      setPlayerEnergy((energy) => Math.max(0, energy - 1));
    }

    setPlayerAttackSignal((signal) => signal + 1);

    schedule(250, () => {
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
            ...currentEnemy,
            hitPoints: enemyHitPoints,
          }}
          enemyRoster={enemies}
          enemyAttackSignal={enemyAttackSignal}
          monsterDamageSignal={enemyDamageSignal}
          playerAttackSignal={playerAttackSignal}
          playerDamageSignal={playerDamageSignal}
          playerEnergy={playerEnergy}
          playerHealth={playerHealth}
        />

        <Text accessibilityLabel="Turn status" style={styles.turnStatus}>
          {hasLost
            ? "You fell!"
            : isAnimating
              ? "Resolving turn..."
              : `Facing ${currentEnemy.name} | Defeated ${defeatedEnemies}`}
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
            disabledActions={[
              ...(playerEnergy <= 0 ? (["special"] as PlayerAction[]) : []),
              ...(hasLost
                ? (["attack", "defend", "special"] as PlayerAction[])
                : []),
            ]}
            isBusy={isAnimating}
            onAction={handleAction}
          />
        </View>
      </View>
    </ScreenShell>
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
    paddingBottom: 18,
  },
  lowerLayoutMirrored: {
    flexDirection: "row-reverse",
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
    backgroundColor: colors.paperLight,
    borderColor: colors.ink,
    borderRadius: 8,
    borderWidth: 2,
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
