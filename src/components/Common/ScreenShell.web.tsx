import { type PropsWithChildren } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { useThemeColors } from "@/components/Common/theme";

export function ScreenShell({ children, compact = false }: PropsWithChildren<{ compact?: boolean }>) {
  const colors = useThemeColors();
  return <ScrollView style={{ flex: 1, backgroundColor: colors.paper }} contentContainerStyle={[styles.phoneFrame, compact && styles.compact]}>{children}</ScrollView>;
}

const styles = StyleSheet.create({
  phoneFrame: { flexGrow: 1, gap: 12, justifyContent: "center", paddingHorizontal: 16, paddingVertical: 8, width: "100%", minHeight: "100%" },
  compact: { gap: 4, justifyContent: "space-between", paddingHorizontal: 8 },
});
