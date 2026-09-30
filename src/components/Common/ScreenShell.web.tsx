import { type PropsWithChildren } from "react";
import { ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import { useThemeColors } from "@/components/Common/theme";

export function ScreenShell({ children, compact = false }: PropsWithChildren<{ compact?: boolean }>) {
  const colors = useThemeColors();
  const { height } = useWindowDimensions();
  const tight = height < 740;
  return <ScrollView style={{ flex: 1, backgroundColor: colors.paper }} contentContainerStyle={[styles.phoneFrame, compact && styles.compact, tight && styles.tight, { minHeight: height }]}>{children}</ScrollView>;
}

const styles = StyleSheet.create({
  phoneFrame: { flexGrow: 1, gap: 12, justifyContent: "center", paddingHorizontal: 16, paddingVertical: 8, width: "100%" },
  compact: { gap: 4, justifyContent: "space-between", paddingHorizontal: 8 },
  tight: { gap: 6, paddingHorizontal: 10 },
});
