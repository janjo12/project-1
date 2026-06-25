import { FontAwesome } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { type ThemeColors, useThemeColors } from "@/components/theme";

type ResourceBarProps = {
  accessibilityLabel: string;
  color: string;
  current: number;
  icon: keyof typeof FontAwesome.glyphMap;
  max: number;
  panelPosition?: "first" | "last" | "middle" | "single";
  testID: string;
};

type ResourceBarGroupProps = {
  children: React.ReactNode;
};

type DebugBarProps = {
  accessibilityLabel: string;
  accessibilityRole: "text";
  children: React.ReactNode;
};

export function ResourceBar({
  accessibilityLabel,
  color,
  current,
  icon,
  max,
  panelPosition = "single",
  testID,
}: ResourceBarProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const safeMax = Math.max(1, max);
  const fillPercent = Math.max(0, Math.min(100, (current / safeMax) * 100));

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.row,
        panelPosition !== "single" && styles.connectedRow,
        panelPosition !== "first" &&
          panelPosition !== "single" &&
          styles.overlappedRow,
        (panelPosition === "first" || panelPosition === "single") &&
          styles.firstRow,
        (panelPosition === "last" || panelPosition === "single") &&
          styles.lastRow,
      ]}
      testID={testID}
    >
      <FontAwesome
        color={color}
        name={icon}
        size={13}
        testID={`${testID}-icon`}
      />
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              backgroundColor: color,
              width: `${fillPercent}%`,
            },
          ]}
          testID={`${testID}-fill`}
        />
      </View>
    </View>
  );
}

export function ResourceBarGroup({ children }: ResourceBarGroupProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.playerBars}>
      {children}
    </View>
  );
}

export function DebugBar({
  children
}: DebugBarProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <Text style={styles.turnStatus}>
      {children}
    </Text>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    connectedRow: {
      borderRadius: 0,
    },
    fill: {
      borderRadius: 999,
      height: "100%",
    },
    firstRow: {
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
    },
    lastRow: {
      borderBottomLeftRadius: 8,
      borderBottomRightRadius: 8,
    },
    overlappedRow: {
      marginTop: -2,
    },
    playerBars: {
      gap: 6,
    },
    row: {
      alignItems: "center",
      backgroundColor: colors.paper,
      borderColor: colors.resourceBorder,
      borderRadius: 8,
      borderWidth: 2,
      flexDirection: "row",
      gap: 6,
      minHeight: 24,
      paddingHorizontal: 7,
      paddingVertical: 5,
      width: "100%",
    },
    track: {
      backgroundColor: colors.paperLight,
      borderRadius: 999,
      flex: 1,
      height: 10,
      overflow: "hidden",
    },
    turnStatus: {
      color: colors.fadedInk,
      fontSize: 16,
      fontWeight: "900",
      minHeight: 22,
      textAlign: "center",
    },
  });
}
