import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  ActionControls,
  type PlayerAction,
} from "@/components/action-controls";
import { DungeonMapPlaceholder } from "@/components/dungeon-map-placeholder";
import { type Enemy, GameViewPanel } from "@/components/game-view-panel";
import { ScreenShell } from "@/components/screen-shell";
import { colors } from "@/components/theme";
import type { Handedness } from "@/utils/settings-storage";

type GameScreenProps = {
  handedness: Handedness;
  onGameOver: (score: number) => void;
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

export function GameScreen({ handedness, onGameOver }: GameScreenProps) {
  const isLeftHanded = handedness === "left";
  const timeoutIds = useRef<ReturnType<typeof setTimeout>[]>([]);
  const defeatedEnemiesRef = useRef(0);
  const [enemyIndex, setEnemyIndex] = useState(0);
  const [defeatedEnemies, setDefeatedEnemies] = useState(0);
  const [enemyHitPoints, setEnemyHitPoints] = useState(ENEMIES[0].hitPoints);
  const [enemyAttackSignal, setEnemyAttackSignal] = useState(0);
  const [enemyDamageSignal, setEnemyDamageSignal] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [playerAttackSignal, setPlayerAttackSignal] = useState(0);
  const [playerDamageSignal, setPlayerDamageSignal] = useState(0);
  const [playerEnergy, setPlayerEnergy] = useState(PLAYER_STARTING_ENERGY);
  const [playerHealth, setPlayerHealth] = useState(PLAYER_STARTING_HEALTH);

  const hasLost = playerHealth <= 0;
  const currentEnemy = ENEMIES[enemyIndex];

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

  function startEnemyMove(isDefending: boolean) {
    setEnemyAttackSignal((signal) => signal + 1);

    if (!isDefending) {
      schedule(250, () => {
        setPlayerDamageSignal((signal) => signal + 1);
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
        setEnemyIndex((index) => (index + 1) % ENEMIES.length);
        setEnemyHitPoints(ENEMIES[(enemyIndex + 1) % ENEMIES.length].hitPoints);
        finishTurn();
        return;
      }

      startEnemyMove(false);
    });
  }

  return (
    <ScreenShell compact>
      <View style={styles.container}>
        <GameViewPanel
          enemy={{
            ...currentEnemy,
            hitPoints: enemyHitPoints,
          }}
          enemyRoster={ENEMIES}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 10,
  },
  lowerLayout: {
    flex: 1,
    flexDirection: "row",
    gap: 14,
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
});
