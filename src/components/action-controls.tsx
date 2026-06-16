import { FontAwesome, Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { type ThemeColors, useThemeColors } from "@/components/theme";
import type { Direction } from "@/utils/dungeon-map";

export type PlayerAction = "attack" | "defend" | "special";

type ActionControlsProps = {
  disabledActions?: PlayerAction[];
  disabledDirections?: Direction[];
  floorItemLabel?: string | null;
  isItemDisabled?: boolean;
  isBusy?: boolean;
  itemLabel?: string | null;
  onAction: (action: PlayerAction) => void;
  onPickupItem?: () => void;
  onUseItem?: () => void;
  onMove?: (direction: Direction) => void;
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

const actions: PlayerAction[] = ["special", "attack", "defend"];

const arrowIcons = {
  east: "arrow-forward",
  north: "arrow-up",
  south: "arrow-down",
  west: "arrow-back",
} as const;

export function ActionControls({
  disabledActions = [],
  disabledDirections = [],
  floorItemLabel = null,
  isItemDisabled = true,
  isBusy = false,
  itemLabel = null,
  onAction,
  onPickupItem = () => {},
  onUseItem = () => {},
  onMove = () => {},
}: ActionControlsProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.floorItemSlot}>
        {floorItemLabel ? (
          <Pressable
            accessibilityLabel={
              itemLabel ? `Swap item for ${floorItemLabel}` : `Pick up ${floorItemLabel}`
            }
            accessibilityRole="button"
            disabled={isBusy}
            onPress={onPickupItem}
            style={({ pressed }) => [
              styles.pickupButton,
              isBusy && styles.disabledButton,
              pressed && styles.pressed,
            ]}
            testID="pickup-item-button"
          >
            <FontAwesome
              color={colors.paper}
              name="hand-paper-o"
              size={15}
              testID="pickup-item-icon"
            />
            <Text style={styles.pickupText}>
              {itemLabel ? `Swap for ${floorItemLabel}` : `Pick Up ${floorItemLabel}`}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.actionGrid} testID="action-button-cluster">
        <Pressable
          accessibilityLabel="Use Item"
          accessibilityRole="button"
          accessibilityState={{ disabled: isBusy || isItemDisabled }}
          disabled={isBusy || isItemDisabled}
          onPress={onUseItem}
          style={({ pressed }) => [
            styles.actionButton,
            !isBusy && !isItemDisabled && styles.activeActionButton,
            (isBusy || isItemDisabled) && styles.disabledButton,
            pressed && styles.pressed,
          ]}
          testID="use-item-button"
        >
          <FontAwesome
            color={colors.ink}
            name="shopping-bag"
            size={14}
            testID="use-item-icon"
          />
          <Text style={styles.actionText}>Use Item</Text>
        </Pressable>

        {actions.map((action) => {
          const { label } = actionDetails[action];
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
                !isBusy && !isDisabled && styles.activeActionButton,
                isDisabled && styles.disabledButton,
                pressed && styles.pressed,
              ]}
              testID={`${action}-action-button`}
            >
              <FontAwesome
                color={colors.ink}
                name={actionDetails[action].icon}
                size={14}
              />
              <Text style={styles.actionText}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View
        style={styles.dPad}
        testID="direction-controls"
      >
        <View style={styles.dPadRow}>
          <View style={styles.dPadSpacer} />
          <ArrowButton
            color={colors.ink}
            direction="north"
            disabled={isBusy || disabledDirections.includes("north")}
            onMove={onMove}
            styles={styles}
          />
          <View style={styles.dPadSpacer} />
        </View>
        <View style={styles.dPadRow}>
          <ArrowButton
            color={colors.ink}
            direction="west"
            disabled={isBusy || disabledDirections.includes("west")}
            onMove={onMove}
            styles={styles}
          />
          <View style={styles.dPadCenter} />
          <ArrowButton
            color={colors.ink}
            direction="east"
            disabled={isBusy || disabledDirections.includes("east")}
            onMove={onMove}
            styles={styles}
          />
        </View>
        <View style={styles.dPadRow}>
          <View style={styles.dPadSpacer} />
          <ArrowButton
            color={colors.ink}
            direction="south"
            disabled={isBusy || disabledDirections.includes("south")}
            onMove={onMove}
            styles={styles}
          />
          <View style={styles.dPadSpacer} />
        </View>
      </View>
    </View>
  );
}

type ArrowButtonProps = {
  color: string;
  direction: Direction;
  disabled: boolean;
  onMove: (direction: Direction) => void;
  styles: ReturnType<typeof createStyles>;
};

function ArrowButton({
  color,
  direction,
  disabled,
  onMove,
  styles,
}: ArrowButtonProps) {
  return (
    <Pressable
      accessibilityLabel={`Move ${direction}`}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => onMove(direction)}
      style={({ pressed }) => [
        styles.arrowButton,
        disabled && styles.disabledButton,
        pressed && styles.pressed,
      ]}
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
      minWidth: 124,
      paddingBottom: 8,
    },
    floorItemSlot: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: 40,
      width: 124,
    },
    pickupButton: {
      alignItems: "center",
      backgroundColor: colors.sepia,
      borderRadius: 8,
      flexDirection: "row",
      gap: 6,
      justifyContent: "center",
      minHeight: 36,
      paddingHorizontal: 8,
      width: 124,
    },
    pickupText: {
      color: colors.paper,
      flex: 1,
      fontSize: 11,
      fontWeight: "800",
      lineHeight: 13,
      textAlign: "center",
    },
    actionGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      justifyContent: "center",
      width: 124,
    },
    actionButton: {
      alignItems: "center",
      backgroundColor: "transparent",
      borderColor: colors.sepia,
      borderRadius: 999,
      borderWidth: 2,
      gap: 2,
      height: 58,
      justifyContent: "center",
      paddingHorizontal: 4,
      width: 58,
    },
    activeActionButton: {
      backgroundColor: colors.paperLight,
    },
    actionText: {
      color: colors.ink,
      fontSize: 9,
      fontWeight: "700",
      lineHeight: 10,
      textAlign: "center",
    },
    disabledButton: {
      opacity: 0.38,
    },
    dPad: {
      alignSelf: "center",
      gap: 4,
      height: 110,
      opacity: 1,
      width: 110,
    },
    dPadRow: {
      flexDirection: "row",
      gap: 4,
    },
    dPadSpacer: {
      height: 34,
      width: 34,
    },
    dPadCenter: {
      backgroundColor: colors.paper,
      borderColor: colors.fadedInk,
      borderRadius: 6,
      borderWidth: 2,
      height: 34,
      width: 34,
    },
    arrowButton: {
      alignItems: "center",
      backgroundColor: colors.paperLight,
      borderColor: colors.ink,
      borderRadius: 8,
      borderWidth: 2,
      height: 34,
      justifyContent: "center",
      width: 34,
    },
    pressed: {
      opacity: 0.72,
    },
  });
}
