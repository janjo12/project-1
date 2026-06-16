import { FontAwesome } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { CombatantSprite } from "@/components/combatant-sprite";
import { type ThemeColors, useThemeColors } from "@/components/theme";
import {
  COMBAT_ANIMATION,
  createCombatAnimationFrame,
  type CombatAnimationFrame,
  type Enemy,
} from "@/entities";

export type { Enemy };

type GameViewPanelProps = {
  animationFrame?: CombatAnimationFrame;
  enemy?: Enemy;
  enemyHealthLossAmount?: number;
  enemyMaxHitPoints?: number;
  enemyRoster?: Enemy[];
  playerEnergyLossAmount?: number;
  playerHealthLossAmount?: number;
};

const defaultEnemy: Enemy = {
  emoji: "\uD83D\uDC7E",
  hitPoints: 3,
  name: "Glitch Imp",
};
const PLAYER_EMOJI = "\uD83E\uDD3A";

export function GameViewPanel({
  animationFrame = createCombatAnimationFrame(),
  enemy = defaultEnemy,
  enemyHealthLossAmount = 0,
  enemyMaxHitPoints = enemy.hitPoints,
  enemyRoster = [defaultEnemy],
  playerEnergyLossAmount = 0,
  playerHealthLossAmount = 0,
}: GameViewPanelProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const bounceOffset = getBounceOffset(animationFrame.bounceElapsed);

  return (
    <View style={styles.panel}>
      <View accessibilityLabel="Enemy roster" style={styles.enemyRoster}>
        {enemyRoster.map((rosterEnemy) => (
          <Text
            accessibilityLabel={`${rosterEnemy.name} roster enemy`}
            key={rosterEnemy.name}
            style={[
              styles.rosterEmoji,
              rosterEnemy.name === enemy.name && styles.currentRosterEmoji,
            ]}
          >
            {rosterEnemy.emoji}
          </Text>
        ))}
      </View>

      <View style={styles.sceneBox}>
        <View style={styles.combatantSlot}>
          <FloatingResourceLoss
            amount={enemyHealthLossAmount}
            color={colors.health}
            icon="heart"
            progress={getProgress(
              animationFrame.enemyHealthLossElapsed,
              COMBAT_ANIMATION.resourceLossDuration,
            )}
            testID="enemy-health-loss"
          />
          <CombatantSprite
            accessibilityLabel={enemy.name}
            attackDirection="right"
            attackProgress={getProgress(
              animationFrame.enemyAttackElapsed,
              COMBAT_ANIMATION.attackDuration,
            )}
            bounceOffset={bounceOffset}
            damageProgress={getProgress(
              animationFrame.enemyDamageElapsed,
              COMBAT_ANIMATION.damageDuration,
            )}
            emoji={enemy.emoji}
          />
          <ResourceBar
            accessibilityLabel="Enemy health"
            color={colors.health}
            current={enemy.hitPoints}
            icon="heart"
            max={enemyMaxHitPoints}
            testID="enemy-health-bar"
          />
        </View>

        <View style={styles.combatantSlot}>
          <FloatingResourceLoss
            amount={playerHealthLossAmount}
            color={colors.health}
            icon="heart"
            progress={getProgress(
              animationFrame.playerHealthLossElapsed,
              COMBAT_ANIMATION.resourceLossDuration,
            )}
            testID="player-health-loss"
          />
          <FloatingResourceLoss
            amount={playerEnergyLossAmount}
            color={colors.energy}
            icon="bolt"
            progress={getProgress(
              animationFrame.playerEnergyLossElapsed,
              COMBAT_ANIMATION.resourceLossDuration,
            )}
            testID="player-energy-loss"
          />
          <CombatantSprite
            accessibilityLabel="Player warrior"
            attackDirection="left"
            attackProgress={getProgress(
              animationFrame.playerAttackElapsed,
              COMBAT_ANIMATION.attackDuration,
            )}
            bounceOffset={bounceOffset}
            damageProgress={getProgress(
              animationFrame.playerDamageElapsed,
              COMBAT_ANIMATION.damageDuration,
            )}
            emoji={PLAYER_EMOJI}
          />
        </View>
      </View>
    </View>
  );
}

type ResourceBarProps = {
  accessibilityLabel: string;
  color: string;
  current: number;
  icon: keyof typeof FontAwesome.glyphMap;
  max: number;
  panelPosition?: "first" | "last" | "middle" | "single";
  testID: string;
};

export function ResourceBar({
  accessibilityLabel,
  color,
  current,
  icon,
  max,
  panelPosition = "single",
  testID,
}: ResourceBarProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const safeMax = Math.max(1, max);
  const fillPercent = Math.max(0, Math.min(100, (current / safeMax) * 100));

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.resourceBarRow,
        panelPosition !== "single" && styles.connectedResourceBarRow,
        panelPosition !== "first" &&
          panelPosition !== "single" &&
          styles.overlappedResourceBarRow,
        (panelPosition === "first" || panelPosition === "single") &&
          styles.firstResourceBarRow,
        (panelPosition === "last" || panelPosition === "single") &&
          styles.lastResourceBarRow,
      ]}
      testID={testID}
    >
      <FontAwesome
        color={color}
        name={icon}
        size={13}
        testID={`${testID}-icon`}
      />
      <View style={styles.resourceBarTrack}>
        <View
          style={[
            styles.resourceBarFill,
            {
              backgroundColor: color,
              width: `${fillPercent}%`,
            },
          ]}
          testID={`${testID}-fill`}
        />
      </View>
    </View>
  );
}

type FloatingResourceLossProps = {
  amount: number;
  color: string;
  icon: "bolt" | "heart";
  progress: number | null;
  testID: string;
};

function FloatingResourceLoss({
  amount,
  color,
  icon,
  progress,
  testID,
}: FloatingResourceLossProps) {
  const styles = createStyles(useThemeColors());

  if (amount <= 0) {
    return null;
  }

  const visibleProgress = progress ?? 1;
  const opacity =
    progress === null
      ? 0
      : progress < 0.62
        ? 1
        : Math.max(0, 1 - (progress - 0.62) / 0.38);
  const translateY = -28 * visibleProgress;

  return (
    <View
      style={[
        styles.floatingLoss,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
      testID={testID}
    >
      <Text style={[styles.floatingLossText, { color }]}>- {amount}</Text>
      <FontAwesome color={color} name={icon} size={16} testID={`${testID}-icon`} />
    </View>
  );
}

function getProgress(elapsed: number | null, duration: number) {
  if (elapsed === null) {
    return null;
  }

  return Math.max(0, Math.min(1, elapsed / duration));
}

function getBounceOffset(elapsed: number) {
  const progress =
    (elapsed % COMBAT_ANIMATION.bounceDuration) /
    COMBAT_ANIMATION.bounceDuration;

  return Math.sin(progress * Math.PI * 2) * COMBAT_ANIMATION.bounceDistance;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    panel: {
      backgroundColor: "transparent",
      gap: 6,
    },
    enemyRoster: {
      flexDirection: "row",
      gap: 8,
      justifyContent: "center",
    },
    rosterEmoji: {
      fontSize: 18,
      lineHeight: 24,
      opacity: 0.55,
    },
    currentRosterEmoji: {
      opacity: 1,
    },
    sceneBox: {
      alignItems: "center",
      backgroundColor: "transparent",
      gap: 10,
      justifyContent: "center",
      minHeight: 230,
      padding: 14,
    },
    combatantSlot: {
      alignItems: "center",
      gap: 6,
      justifyContent: "center",
      minHeight: 92,
      position: "relative",
      width: "100%",
    },
    resourceBarRow: {
      alignItems: "center",
      backgroundColor: colors.paper,
      borderColor: colors.resourceBorder,
      borderRadius: 8,
      borderWidth: 2,
      flexDirection: "row",
      gap: 6,
      minHeight: 24,
      paddingHorizontal: 7,
      paddingVertical: 5,
      width: "100%",
    },
    connectedResourceBarRow: {
      borderRadius: 0,
    },
    overlappedResourceBarRow: {
      marginTop: -2,
    },
    firstResourceBarRow: {
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
    },
    lastResourceBarRow: {
      borderBottomLeftRadius: 8,
      borderBottomRightRadius: 8,
    },
    resourceBarTrack: {
      backgroundColor: colors.paperLight,
      borderRadius: 999,
      flex: 1,
      height: 10,
      overflow: "hidden",
    },
    resourceBarFill: {
      borderRadius: 999,
      height: "100%",
    },
    floatingLoss: {
      alignItems: "center",
      flexDirection: "row",
      gap: 4,
      justifyContent: "center",
      position: "absolute",
      top: -4,
      zIndex: 2,
    },
    floatingLossText: {
      fontSize: 16,
      fontWeight: "900",
    },
  });
}
