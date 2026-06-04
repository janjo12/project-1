import { PropsWithChildren } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { colors } from "@/components/theme";

type ScreenShellProps = PropsWithChildren<{
  compact?: boolean;
}>;

export function ScreenShell({ children, compact = false }: ScreenShellProps) {
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

const styles = StyleSheet.create({
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
    borderColor: colors.ink,
    borderWidth: 3,
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
