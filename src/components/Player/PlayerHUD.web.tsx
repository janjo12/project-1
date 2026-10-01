import { StyleSheet, Text, View } from "react-native";
import { useThemeColors, type ThemeColors } from "@/components/Common/theme";

type ResourceBarProps = { accessibilityLabel: string; color: string; current: number; icon: "heart" | "bolt" | "hourglass-half"; max: number; panelPosition?: "first" | "last" | "middle" | "single"; testID: string; compact?: boolean };
const ICONS = { heart: "♥", bolt: "⚡", "hourglass-half": "⌛" };
export function ResourceBar({ accessibilityLabel, color, current, icon, max, testID, compact = false }: ResourceBarProps) {
  const colors = useThemeColors(); const styles = createStyles(colors);
  const fillPercent = Math.max(0, Math.min(100, current / Math.max(1, max) * 100));
  return <View accessibilityLabel={accessibilityLabel} style={[styles.row, compact && styles.compactRow]} testID={testID}><Text style={{ color, fontSize: 14 }}>{ICONS[icon]}</Text><View style={styles.track}><View style={[styles.fill, { backgroundColor: color, width: `${fillPercent}%` }]} /></View></View>;
}
export function ResourceBarGroup({ children, compact = false }: React.PropsWithChildren<{ compact?: boolean }>) {
  const styles = createStyles(useThemeColors());
  return <View style={[styles.playerBars, compact && styles.compactPlayerBars]}>{children}</View>;
}
export function DebugBar({ children }: React.PropsWithChildren<{ accessibilityLabel: string; accessibilityRole: "text" }>) {
  return <Text style={createStyles(useThemeColors()).turnStatus}>{children}</Text>;
}
function createStyles(colors: ThemeColors) {
  return StyleSheet.create({ row: { alignItems: "center", backgroundColor: colors.paper, borderColor: colors.resourceBorder, borderRadius: 8, borderWidth: 2, flexDirection: "row", gap: 6, minHeight: 24, paddingHorizontal: 7, paddingVertical: 5, width: "100%" }, compactRow: { borderRadius: 8, flex: 1, minWidth: 0, marginTop: 0, width: undefined }, track: { backgroundColor: colors.paperLight, borderRadius: 999, flex: 1, height: 10, overflow: "hidden" }, fill: { borderRadius: 999, height: "100%" }, playerBars: { gap: 6 }, compactPlayerBars: { flexDirection: "row" }, turnStatus: { color: colors.fadedInk, fontSize: 16, fontWeight: "900", minHeight: 16, textAlign: "center" } });
}
