import { Text, View } from "react-native";
import { createStyles } from "@/components/Dungeon/room-scene-styles";
import { useThemeColors } from "@/components/Common/theme";

export function EnemyHealthBar({ accessibilityLabel, color, current, max, testID }: { accessibilityLabel: string; color: string; current: number; max: number; testID: string }) {
  const styles = createStyles(useThemeColors());
  const fillPercent = Math.max(0, Math.min(100, current / Math.max(1, max) * 100));
  return <View accessibilityLabel={accessibilityLabel} style={styles.enemyHealthBarTrack} testID={testID}><View style={[styles.enemyHealthBarFill, { backgroundColor: color, width: `${fillPercent}%` }]} testID={`${testID}-fill`} /></View>;
}

export function FloatingResourceLoss({ amount, color, icon, progress, testID }: { amount: number; color: string; icon: "bolt" | "heart"; progress: number | null; testID: string }) {
  const styles = createStyles(useThemeColors());
  if (amount <= 0) return null;
  const visibleProgress = progress ?? 1;
  const opacity = progress === null ? 0 : progress < 0.62 ? 1 : Math.max(0, 1 - (progress - 0.62) / 0.38);
  return <View style={[styles.floatingLoss, { opacity, transform: [{ translateY: -28 * visibleProgress }] }]} testID={testID}><Text style={[styles.floatingLossText, { color }]}>- {amount} {icon === "heart" ? "♥" : "⚡"}</Text></View>;
}
