import { PropsWithChildren } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type ThemeColors, useThemeColors } from "@/components/Common/theme";

type ScreenShellProps = PropsWithChildren<{
  compact?: boolean;
}>;

export function ScreenShell({ children, compact = false }: ScreenShellProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const styles = createStyles(colors);
  const tight = height < 740;

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.phoneFrame,
          compact && styles.compactPhoneFrame,
          tight && styles.tightPhoneFrame,
          { paddingTop: Math.max(8, insets.top + (compact ? 0 : 4)), paddingBottom: Math.max(8, insets.bottom + (compact ? 0 : 4)) },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      backgroundColor: colors.paper,
      flex: 1,
      overflow: "hidden",
    },
    phoneFrame: {
      backgroundColor: colors.paper,
      flex: 1,
      gap: 12,
      justifyContent: "center",
      paddingHorizontal: 16,
      width: "100%",
    },
    compactPhoneFrame: {
      gap: 4,
      justifyContent: "space-between",
      paddingHorizontal: 8,
    },
    tightPhoneFrame: {
      gap: 6,
      paddingHorizontal: 10,
    },
  });
}
