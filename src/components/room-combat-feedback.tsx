import { FontAwesome } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { createStyles } from "@/components/room-scene-styles";
import { useThemeColors } from "@/components/theme";

type EnemyHealthBarProps = {
  accessibilityLabel: string;
  color: string;
  current: number;
  max: number;
  testID: string;
};

export function EnemyHealthBar({
  accessibilityLabel,
  color,
  current,
  max,
  testID,
}: EnemyHealthBarProps) {
  const styles = createStyles(useThemeColors());
  const safeMax = Math.max(1, max);
  const fillPercent = Math.max(0, Math.min(100, (current / safeMax) * 100));

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={styles.enemyHealthBarTrack}
      testID={testID}
    >
      <View
        style={[
          styles.enemyHealthBarFill,
          {
            backgroundColor: color,
            width: `${fillPercent}%`,
          },
        ]}
        testID={`${testID}-fill`}
      />
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

export function FloatingResourceLoss({
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

