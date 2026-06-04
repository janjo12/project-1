import { PropsWithChildren } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { type ThemeColors, useThemeColors } from "@/components/theme";

type ScreenShellProps = PropsWithChildren<{
  compact?: boolean;
}>;

export function ScreenShell({ children, compact = false }: ScreenShellProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.scrollContent,
        compact && styles.compactScrollContent,
      ]}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={[styles.phoneFrame, compact && styles.compactPhoneFrame]}>
        {children}
      </View>
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  scrollContent: {
    backgroundColor: colors.paperDark,
    flexGrow: 1,
    padding: 18,
  },
  compactScrollContent: {
    padding: 12,
  },
  phoneFrame: {
    backgroundColor: colors.paper,
    flex: 1,
    gap: 24,
    minHeight: 760,
    padding: 28,
  },
  compactPhoneFrame: {
    minHeight: 820,
    padding: 14,
  },
  });
}
