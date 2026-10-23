import { StyleSheet, Text, View } from "react-native";
import { useThemeColors, type ThemeColors } from "@/components/Common/theme";
import { PixelSprite } from "@/components/Common/PixelSprite";
import { PlayerAura } from "@/components/Common/PlayerAura";

type ResourceBarProps = { accessibilityLabel: string; color: string; current: number; icon: "heart" | "bolt" | "hourglass-half"; max: number; panelPosition?: "first" | "last" | "middle" | "single"; testID: string; compact?: boolean };
const ICONS = { heart: "♥", bolt: "⚡", "hourglass-half": "⌛" };
export function ResourceBar({ accessibilityLabel, color, current, icon, max, testID, compact = false }: ResourceBarProps) {
  const colors = useThemeColors(); const styles = createStyles(colors);
  const fillPercent = Math.max(0, Math.min(100, current / Math.max(1, max) * 100));
  return <View accessibilityLabel={accessibilityLabel} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max, now: current }} aria-valuemin={0} aria-valuemax={max} aria-valuenow={current} style={[styles.row, compact && styles.compactRow]} testID={testID}><Text style={{ color, fontSize: 14 }}>{ICONS[icon]}</Text><View style={styles.track}><View style={[styles.fill, { backgroundColor: color, width: `${fillPercent}%` }]} /></View></View>;
}
export function ResourceBarGroup({ children, compact = false, playerSprite, playerAuraColor }: React.PropsWithChildren<{ compact?: boolean; playerSprite?: string; playerAuraColor?: string }>) {
  const styles = createStyles(useThemeColors());
  return <View style={styles.group}>
    {playerSprite ? <View accessibilityLabel="Player character" style={styles.playerSpriteSlot}>
      {playerAuraColor ? <PlayerAura color={playerAuraColor} size={48} /> : null}
      <PixelSprite sprite={playerSprite} label="Player character" size={36} />
    </View> : null}
    <View style={[styles.playerBars, compact && styles.compactPlayerBars]}>{children}</View>
  </View>;
}
export function DebugBar({ children, testID }: React.PropsWithChildren<{ accessibilityLabel: string; accessibilityRole: "text"; testID?: string }>) {
  return <Text testID={testID} style={createStyles(useThemeColors()).turnStatus}>{children}</Text>;
}
function createStyles(colors: ThemeColors) {
  return StyleSheet.create({ row: { alignItems: "center", backgroundColor: colors.paper, borderColor: colors.resourceBorder, borderRadius: 8, borderWidth: 2, flexDirection: "row", gap: 6, minHeight: 24, paddingHorizontal: 7, paddingVertical: 5, width: "100%" }, compactRow: { borderRadius: 8, flex: 1, minWidth: 0, marginTop: 0, width: undefined }, track: { backgroundColor: colors.paperLight, borderRadius: 999, flex: 1, height: 10, overflow: "hidden" }, fill: { borderRadius: 999, height: "100%" }, group: { alignItems: "center", flexDirection: "row", gap: 8, width: "100%" }, playerBars: { flex: 1, gap: 6, minWidth: 0 }, compactPlayerBars: { flexDirection: "row" }, playerSpriteSlot: { alignItems: "center", flexShrink: 0, height: 44, justifyContent: "center", position: "relative", width: 44 }, turnStatus: { color: colors.fadedInk, fontSize: 16, fontWeight: "900", minHeight: 16, textAlign: "center" } });
}
