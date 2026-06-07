import { FontAwesome } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { CombatantSprite } from "@/components/combatant-sprite";
import { type ThemeColors, useThemeColors } from "@/components/theme";

export type Enemy = {
  emoji: string;
  hitPoints: number;
  name: string;
};

type GameViewPanelProps = {
  enemy?: Enemy;
  enemyAttackSignal?: number;
  enemyHealthLossAmount?: number;
  enemyHealthLossSignal?: number;
  enemyMaxHitPoints?: number;
  enemyRoster?: Enemy[];
  monsterDamageSignal?: number;
  playerAttackSignal?: number;
  playerDamageSignal?: number;
  playerEnergy?: number;
  playerEnergyLossAmount?: number;
  playerEnergyLossSignal?: number;
  playerHealth?: number;
  playerHealthLossAmount?: number;
  playerHealthLossSignal?: number;
};

const defaultEnemy: Enemy = {
  emoji: "\uD83D\uDC7E",
  hitPoints: 3,
  name: "Glitch Imp",
};
const PLAYER_EMOJI = "\uD83E\uDD3A";

export function GameViewPanel({
  enemy = defaultEnemy,
  enemyAttackSignal = 0,
  enemyHealthLossAmount = 0,
  enemyHealthLossSignal = 0,
  enemyMaxHitPoints = enemy.hitPoints,
  enemyRoster = [defaultEnemy],
  monsterDamageSignal = 0,
  playerAttackSignal = 0,
  playerDamageSignal = 0,
  playerEnergyLossAmount = 0,
  playerEnergyLossSignal = 0,
  playerHealthLossAmount = 0,
  playerHealthLossSignal = 0,
}: GameViewPanelProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

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
            signal={enemyHealthLossSignal}
            testID="enemy-health-loss"
          />
          <CombatantSprite
            accessibilityLabel={enemy.name}
            attackDirection="right"
            attackSignal={enemyAttackSignal}
            damageSignal={monsterDamageSignal}
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
            signal={playerHealthLossSignal}
            testID="player-health-loss"
          />
          <FloatingResourceLoss
            amount={playerEnergyLossAmount}
            color={colors.energy}
            icon="bolt"
            signal={playerEnergyLossSignal}
            testID="player-energy-loss"
          />
          <CombatantSprite
            accessibilityLabel="Player warrior"
            attackDirection="left"
            attackSignal={playerAttackSignal}
            damageSignal={playerDamageSignal}
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
  icon: "bolt" | "heart";
  max: number;
  testID: string;
};

export function ResourceBar({
  accessibilityLabel,
  color,
  current,
  icon,
  max,
  testID,
}: ResourceBarProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const safeMax = Math.max(1, max);
  const fillPercent = `${Math.max(0, Math.min(100, (current / safeMax) * 100))}%`;

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={styles.resourceBarRow}
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
              width: fillPercent,
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
  signal: number;
  testID: string;
};

function FloatingResourceLoss({
  amount,
  color,
  icon,
  signal,
  testID,
}: FloatingResourceLossProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(0);
  const previousSignal = useRef(signal);
  const styles = createStyles(useThemeColors());
  const lossStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
    if (previousSignal.current === signal) {
      return;
    }

    previousSignal.current = signal;
    opacity.set(1);
    translateY.set(0);
    opacity.set(
      withSequence(
        withTiming(1, { duration: 420 }),
        withTiming(0, { duration: 260 }),
      ),
    );
    translateY.set(withTiming(-28, { duration: 680 }));
  }, [opacity, signal, translateY]);

  if (amount <= 0) {
    return null;
  }

  return (
    <Animated.View style={[styles.floatingLoss, lossStyle]} testID={testID}>
      <Text style={[styles.floatingLossText, { color }]}>- {amount}</Text>
      <FontAwesome color={color} name={icon} size={16} testID={`${testID}-icon`} />
    </Animated.View>
  );
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
      flexDirection: "row",
      gap: 6,
      width: "100%",
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
