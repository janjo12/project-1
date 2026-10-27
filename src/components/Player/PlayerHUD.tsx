import { FontAwesome } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { type ThemeColors, useThemeColors } from "@/components/Common/theme";
import { PixelSprite } from "@/components/Common/PixelSprite";
import { PlayerAura } from "@/components/Common/PlayerAura";

type ResourceBarProps = {
  accessibilityLabel: string;
  color: string;
  current: number;
  icon: keyof typeof FontAwesome.glyphMap;
  max: number;
  panelPosition?: "first" | "last" | "middle" | "single";
  testID: string;
  compact?: boolean;
};

type ResourceBarGroupProps = {
  children: React.ReactNode;
  compact?: boolean;
  playerSprite?: string;
  playerAuraColor?: string;
};

type DebugBarProps = {
  accessibilityLabel: string;
  accessibilityRole: "text";
  testID?: string;
  children: React.ReactNode;
};

export function ResourceBarIcon({ color, icon, testID }: { color: string; icon: keyof typeof FontAwesome.glyphMap; testID?: string }) {
  return <FontAwesome color={color} name={icon} size={16} testID={testID} />;
}

export function ResourceBar({
  accessibilityLabel,
  color,
  current,
  icon,
  max,
  panelPosition = "single",
  testID,
  compact = false,
}: ResourceBarProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const safeMax = Math.max(1, max);
  const fillPercent = Math.max(0, Math.min(100, (current / safeMax) * 100));

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: safeMax, now: current }}
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
        compact && styles.compactRow,
      ]}
      testID={testID}
    >
      <View style={styles.iconSlot}>
        <ResourceBarIcon color={color} icon={icon} testID={`${testID}-glyph`} />
      </View>
      <View style={styles.track} testID={`${testID}-track`}>
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

export function ResourceBarGroup({ children, compact = false, playerSprite, playerAuraColor }: ResourceBarGroupProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.group}>
      {playerSprite ? (
        <View accessibilityLabel="Player character" style={styles.playerSpriteSlot}>
          {playerAuraColor ? <PlayerAura color={playerAuraColor} size={48} /> : null}
          <PixelSprite sprite={playerSprite} label="Player character" size={36} />
        </View>
      ) : null}
      <View style={[styles.playerBars, compact && styles.compactPlayerBars]}>
        {children}
      </View>
    </View>
  );
}

export function DebugBar({
  children,
  accessibilityLabel,
  accessibilityRole,
  testID,
}: DebugBarProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <Text accessibilityLabel={accessibilityLabel} accessibilityRole={accessibilityRole} testID={testID} style={styles.turnStatus}>
      {children}
    </Text>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    connectedRow: {
      borderRadius: 0,
    },
    compactPlayerBars: {
      flexDirection: "row",
      gap: 3,
    },
    group: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      width: "100%",
    },
    compactRow: {
      borderRadius: 8,
      flex: 1,
      marginTop: 0,
      minWidth: 0,
      width: undefined,
    },
    fill: {
      borderRadius: 999,
      height: "100%",
    },
    iconSlot: {
      alignItems: "center",
      justifyContent: "center",
      width: 18,
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
      flex: 1,
      gap: 3,
      minWidth: 0,
    },
    playerSpriteSlot: {
      alignItems: "center",
      flexShrink: 0,
      height: 44,
      justifyContent: "center",
      position: "relative",
      width: 44,
    },
    row: {
      alignItems: "center",
      backgroundColor: colors.paper,
      borderRadius: 8,
      borderWidth: 0,
      flexDirection: "row",
      gap: 4,
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
      minHeight: 16,
      textAlign: "center",
    },
  });
}
