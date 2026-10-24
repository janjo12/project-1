import { StyleSheet, Text, View } from "react-native";
import { useThemeColors, type ThemeColors } from "@/components/Common/theme";
import { PixelSprite } from "@/components/Common/PixelSprite";
import { PlayerAura } from "@/components/Common/PlayerAura";

type ResourceBarProps = { accessibilityLabel: string; color: string; current: number; icon: "heart" | "bolt" | "hourglass-half"; max: number; panelPosition?: "first" | "last" | "middle" | "single"; testID: string; compact?: boolean };
export function ResourceBar({ accessibilityLabel, color, current, icon, max, testID, compact = false }: ResourceBarProps) {
  const colors = useThemeColors(); const styles = createStyles(colors);
  const fillPercent = Math.max(0, Math.min(100, current / Math.max(1, max) * 100));
  const iconPath = icon === "bolt"
    ? "M13 2 4 14h6l-1 8 11-13h-7l2-7z"
    : icon === "heart"
      ? "M12 21.35 10.55 20.03C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09A6 6 0 0 1 16.5 3C19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54z"
      : "M6 2h12v6l-4 4 4 4v6H6v-6l4-4-4-4zm2 2v3.17l4 4 4-4V4zm0 12.83V20h8v-5.17l-4-4z";
  const iconName = icon === "hourglass-half" ? "hourglass" : icon;
  return <View accessibilityLabel={accessibilityLabel} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max, now: current }} aria-valuemin={0} aria-valuemax={max} aria-valuenow={current} style={[styles.row, compact && styles.compactRow]} testID={testID}><View style={styles.iconSlot}>
    <svg aria-hidden="true" data-testid={`${testID}-glyph`} data-icon={iconName} width="16" height="16" viewBox="0 0 24 24" style={{ display: "block", color }}><path fill="currentColor" d={iconPath} /></svg>
  </View><View style={styles.track} testID={`${testID}-track`}><View style={[styles.fill, { backgroundColor: color, width: `${fillPercent}%` }]} /></View></View>;
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
  return StyleSheet.create({ row: { alignItems: "center", backgroundColor: colors.paper, borderRadius: 8, borderWidth: 0, flexDirection: "row", gap: 4, minHeight: 24, paddingHorizontal: 7, paddingVertical: 5, width: "100%" }, compactRow: { borderRadius: 8, flex: 1, minWidth: 0, marginTop: 0, width: undefined }, track: { backgroundColor: colors.paperLight, borderRadius: 999, flex: 1, height: 10, overflow: "hidden" }, fill: { borderRadius: 999, height: "100%" }, iconSlot: { alignItems: "center", justifyContent: "center", width: 18 }, group: { alignItems: "center", flexDirection: "row", gap: 8, width: "100%" }, playerBars: { flex: 1, gap: 3, minWidth: 0 }, compactPlayerBars: { flexDirection: "row", gap: 3 }, playerSpriteSlot: { alignItems: "center", flexShrink: 0, height: 44, justifyContent: "center", position: "relative", width: 44 }, turnStatus: { color: colors.fadedInk, fontSize: 16, fontWeight: "900", minHeight: 16, textAlign: "center" } });
}
