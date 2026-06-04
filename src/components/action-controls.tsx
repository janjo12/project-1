import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { type ThemeColors, useThemeColors } from "@/components/theme";

export type PlayerAction = "attack" | "defend" | "special";

type ActionControlsProps = {
  disabledActions?: PlayerAction[];
  isBusy?: boolean;
  onAction: (action: PlayerAction) => void;
};

const actions: { action: PlayerAction; label: string }[] = [
  { action: "special", label: "Special" },
  { action: "defend", label: "Defend" },
  { action: "attack", label: "Attack" },
];

const arrowIcons = {
  down: "arrow-down",
  left: "arrow-back",
  right: "arrow-forward",
  up: "arrow-up",
} as const;

export function ActionControls({
  disabledActions = [],
  isBusy = false,
  onAction,
}: ActionControlsProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.actionCluster} testID="action-button-cluster">
        {actions.map(({ action, label }) => {
          const isDisabled = isBusy || disabledActions.includes(action);

          return (
            <Pressable
              accessibilityLabel={label}
              accessibilityRole="button"
              accessibilityState={{ disabled: isDisabled }}
              disabled={isDisabled}
              key={label}
              onPress={() => onAction(action)}
              style={({ pressed }) => [
                styles.actionButton,
                isDisabled && styles.disabledButton,
                pressed && styles.pressed,
              ]}
              testID={`${action}-action-button`}
            >
              <Text style={styles.actionText}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.dPad}>
        <View style={styles.dPadRow}>
          <View style={styles.dPadSpacer} />
          <ArrowButton direction="up" color={colors.ink} styles={styles} />
          <View style={styles.dPadSpacer} />
        </View>
        <View style={styles.dPadRow}>
          <ArrowButton direction="left" color={colors.ink} styles={styles} />
          <View style={styles.dPadCenter} />
          <ArrowButton direction="right" color={colors.ink} styles={styles} />
        </View>
        <View style={styles.dPadRow}>
          <View style={styles.dPadSpacer} />
          <ArrowButton direction="down" color={colors.ink} styles={styles} />
          <View style={styles.dPadSpacer} />
        </View>
      </View>
    </View>
  );
}

type ArrowButtonProps = {
  color: string;
  direction: "down" | "left" | "right" | "up";
  styles: ReturnType<typeof createStyles>;
};

function ArrowButton({ color, direction, styles }: ArrowButtonProps) {
  return (
    <Pressable
      accessibilityLabel={`Move ${direction}`}
      accessibilityRole="button"
      onPress={() => {}}
      style={({ pressed }) => [styles.arrowButton, pressed && styles.pressed]}
    >
      <Ionicons
        color={color}
        name={arrowIcons[direction]}
        size={24}
        testID={`move-${direction}-icon`}
      />
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 18,
    justifyContent: "flex-end",
    minWidth: 112,
    paddingBottom: 8,
  },
  actionCluster: {
    alignItems: "center",
    gap: 10,
    justifyContent: "center",
  },
  actionButton: {
    alignItems: "center",
    backgroundColor: colors.paperLight,
    borderColor: colors.sepia,
    borderRadius: 999,
    borderWidth: 2,
    height: 74,
    justifyContent: "center",
    paddingHorizontal: 6,
    width: 74,
  },
  actionText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  disabledButton: {
    opacity: 0.38,
  },
  dPad: {
    alignSelf: "center",
    gap: 4,
  },
  dPadRow: {
    flexDirection: "row",
    gap: 4,
  },
  dPadSpacer: {
    height: 42,
    width: 42,
  },
  dPadCenter: {
    backgroundColor: colors.paper,
    borderColor: colors.fadedInk,
    borderRadius: 6,
    borderWidth: 2,
    height: 42,
    width: 42,
  },
  arrowButton: {
    alignItems: "center",
    backgroundColor: colors.paperLight,
    borderColor: colors.ink,
    borderRadius: 8,
    borderWidth: 2,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  pressed: {
    opacity: 0.72,
  },
  });
}
