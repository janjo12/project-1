import { FontAwesome, Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { type ThemeColors, useThemeColors } from "@/components/theme";

export type PlayerAction = "attack" | "defend" | "special";

type ActionControlsProps = {
  disabledActions?: PlayerAction[];
  isBusy?: boolean;
  onAction: (action: PlayerAction) => void;
  onConfirmAction: () => void;
  selectedAction?: PlayerAction | null;
};

export const actionDetails: Record<
  PlayerAction,
  { description: string; icon: keyof typeof FontAwesome.glyphMap; label: string }
> = {
  attack: {
    description: "Strike now. The enemy answers back.",
    icon: "flash",
    label: "Attack",
  },
  defend: {
    description: "Brace yourself. The enemy deals no damage.",
    icon: "shield",
    label: "Defend",
  },
  special: {
    description: "Spend 1 energy to hit twice as hard.",
    icon: "bolt",
    label: "Special",
  },
};

const actions: PlayerAction[] = [
  "special",
  "defend",
  "attack",
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
  onConfirmAction,
  selectedAction = null,
}: ActionControlsProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const selectedActionDetails = selectedAction
    ? actionDetails[selectedAction]
    : null;
  const canConfirm = Boolean(selectedActionDetails) && !isBusy;

  return (
    <View style={styles.container}>
      <View style={styles.actionCluster} testID="action-button-cluster">
        {actions.map((action) => {
          const { label } = actionDetails[action];
          const isDisabled = isBusy || disabledActions.includes(action);
          const isSelected = selectedAction === action && !isBusy;

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
                !isBusy && !isDisabled && styles.activeActionButton,
                isSelected && styles.selectedActionButton,
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

      <Pressable
        accessibilityLabel={
          selectedActionDetails
            ? `End Turn: ${selectedActionDetails.label}`
            : "Select An Action"
        }
        accessibilityRole="button"
        accessibilityState={{ disabled: !canConfirm }}
        disabled={!canConfirm}
        onPress={onConfirmAction}
        style={({ pressed }) => [
          styles.confirmButton,
          canConfirm && styles.confirmButtonActive,
          pressed && styles.pressed,
        ]}
        testID="action-confirmation-button"
      >
        {selectedActionDetails ? (
          <>
            <FontAwesome
              color={colors.paper}
              name={selectedActionDetails.icon}
              size={22}
              testID="selected-action-icon"
            />
            <View style={styles.confirmTextGroup}>
              <Text style={[styles.confirmTitle, styles.confirmTitleActive]}>
                {selectedActionDetails.label}
              </Text>
              <Text
                style={[
                  styles.confirmDescription,
                  styles.confirmDescriptionActive,
                ]}
              >
                {selectedActionDetails.description}
              </Text>
            </View>
          </>
        ) : (
          <Text style={styles.confirmTitle}>Select An Action</Text>
        )}
      </Pressable>

      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.dPad}
        testID="direction-controls"
      >
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
    gap: 8,
    justifyContent: "flex-end",
    minWidth: 132,
    paddingBottom: 8,
  },
  actionCluster: {
    alignItems: "center",
    gap: 10,
    justifyContent: "center",
  },
  actionButton: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderColor: colors.sepia,
    borderRadius: 999,
    borderWidth: 2,
    height: 66,
    justifyContent: "center",
    paddingHorizontal: 6,
    width: 66,
  },
  activeActionButton: {
    backgroundColor: colors.paperLight,
  },
  selectedActionButton: {
    backgroundColor: colors.sepia,
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
  confirmButton: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderColor: colors.fadedInk,
    borderRadius: 8,
    borderWidth: 2,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    minHeight: 84,
    paddingHorizontal: 10,
    paddingVertical: 10,
    width: 132,
  },
  confirmButtonActive: {
    backgroundColor: colors.sepia,
    borderColor: colors.sepia,
  },
  confirmTextGroup: {
    flex: 1,
    gap: 2,
  },
  confirmTitle: {
    color: colors.fadedInk,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  confirmTitleActive: {
    color: colors.paper,
    textAlign: "left",
  },
  confirmDescription: {
    color: colors.fadedInk,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 14,
  },
  confirmDescriptionActive: {
    color: colors.paper,
  },
  dPad: {
    alignSelf: "center",
    display: "none",
    gap: 4,
    height: 0,
    opacity: 0,
    overflow: "hidden",
    width: 0,
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
