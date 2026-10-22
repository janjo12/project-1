import { type PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { SpriteFlightLayer } from "@/components/Common/SpriteFlight";
import { useThemeColors } from "@/components/Common/theme";

export function ScreenShell({ children, compact = false }: PropsWithChildren<{ compact?: boolean }>) {
  const colors = useThemeColors();
  return <View style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden", backgroundColor: colors.paper }}><View style={[styles.phoneFrame, compact && styles.compact]}>{children}</View><SpriteFlightLayer /></View>;
}

const styles = StyleSheet.create({
  phoneFrame: { flex: 1, gap: 12, justifyContent: "center", paddingHorizontal: 16, paddingVertical: 8, width: "100%", minHeight: 0 },
  compact: { gap: 4, justifyContent: "space-between", paddingHorizontal: 8 },
});
