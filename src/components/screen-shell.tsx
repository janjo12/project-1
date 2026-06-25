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
      backgroundColor: colors.paper,
      flexGrow: 1,
    },
    compactScrollContent: {
      backgroundColor: colors.paper,
    },
    phoneFrame: {
      backgroundColor: colors.paper,
      flex: 1,
      gap: 24,
      padding: 20,
      width: "100%",
    },
    compactPhoneFrame: {
      gap: 10,
      padding: 14,
    },
  });
}
