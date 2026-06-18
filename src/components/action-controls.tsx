import { FontAwesome } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { type ThemeColors, useThemeColors } from "@/components/theme";
import type { Direction } from "@/utils/dungeon-map";

export type PlayerAction =
  | "attack"
  | "defend"
  | "descend"
  | "item"
  | "move-east"
  | "move-north"
  | "move-south"
  | "move-west"
  | "pickup-item"
  | "special";

type ActionControlsProps = {
  disabledActions?: PlayerAction[];
  disabledDirections?: Direction[];
  floorItemLabel?: string | null;
  isItemDisabled?: boolean;
  isBusy?: boolean;
  itemLabel?: string | null;
  itemSprite?: string | null;
  nextLevelNumber?: number | null;
  playerAction: (action: PlayerAction) => void;
};

const arrowIcons = {
  east: "arrow-right",
  north: "arrow-up",
  south: "arrow-down",
  west: "arrow-left",
} as const;

export function ActionControls({
  disabledActions = [],
  disabledDirections = [],
  floorItemLabel = null,
  isItemDisabled = true,
  isBusy = false,
  itemLabel = null,
  itemSprite = null,
  nextLevelNumber = null,
  playerAction,
}: ActionControlsProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const isUseItemDisabled = isBusy || isItemDisabled;
  const hasDescentButton = nextLevelNumber !== null;

  return (
    <View style={styles.container}>
      <View style={styles.floorItemSlot}>
        {hasDescentButton ? (
          <Pressable
            accessibilityLabel={`Descend to Level ${nextLevelNumber}`}
            accessibilityRole="button"
            disabled={isBusy}
            onPress={() => playerAction("descend")}
            style={({ pressed }) => [
              styles.pickupButton,
              isBusy && styles.disabledButton,
              pressed && styles.pressed,
            ]}
            testID="descend-button"
          >
            <FontAwesome
              color={colors.paper}
              name="arrow-down"
              size={15}
              testID="descend-icon"
            />
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.68}
              numberOfLines={2}
              style={styles.pickupText}
            >
              Descend to Level {nextLevelNumber}
            </Text>
          </Pressable>
        ) : floorItemLabel ? (
          <Pressable
            accessibilityLabel={
              itemLabel ? `Swap item for ${floorItemLabel}` : `Pick up ${floorItemLabel}`
            }
            accessibilityRole="button"
            disabled={isBusy}
            onPress={() => playerAction("pickup-item")}
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
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.68}
              numberOfLines={2}
              style={styles.pickupText}
            >
              {itemLabel ? `Swap for ${floorItemLabel}` : `Pick Up ${floorItemLabel}`}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.actionGrid} testID="action-button-cluster">
        <CircularButton
          disabled={isUseItemDisabled}
          sprite={itemSprite}
          label={itemLabel ? `${itemLabel}` : "No Item"}
          onPress={() => playerAction("item")}
          styles={styles}
          testID="use-item-button"
        />
        <CircularButton
          disabled={isBusy || disabledActions.includes("special")}
          icon="bolt"
          label="Special"
          onPress={() => playerAction("special")}
          styles={styles}
          testID="special-action-button"
        />
        <CircularButton
          disabled={isBusy || disabledActions.includes("attack")}
          icon="flash"
          label="Attack"
          onPress={() => playerAction("attack")}
          styles={styles}
          testID="attack-action-button"
        />
        <CircularButton
          disabled={isBusy || disabledActions.includes("defend")}
          icon="shield"
          label="Defend"
          onPress={() => playerAction("defend")}
          styles={styles}
          testID="defend-action-button"
        />
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
            playerAction={playerAction}
            styles={styles}
          />
          <View style={styles.dPadSpacer} />
        </View>
        <View style={styles.dPadRow}>
          <ArrowButton
            color={colors.ink}
            direction="west"
            disabled={isBusy || disabledDirections.includes("west")}
            playerAction={playerAction}
            styles={styles}
          />
          <View style={styles.dPadCenter} />
          <ArrowButton
            color={colors.ink}
            direction="east"
            disabled={isBusy || disabledDirections.includes("east")}
            playerAction={playerAction}
            styles={styles}
          />
        </View>
        <View style={styles.dPadRow}>
          <View style={styles.dPadSpacer} />
          <ArrowButton
            color={colors.ink}
            direction="south"
            disabled={isBusy || disabledDirections.includes("south")}
            playerAction={playerAction}
            styles={styles}
          />
          <View style={styles.dPadSpacer} />
        </View>
      </View>
    </View>
  );
}

type CircularButtonProps = {
  disabled: boolean;
  icon?: keyof typeof FontAwesome.glyphMap;
  label?: string;
  sprite?: string | null;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  testID: string;
};

function CircularButton({
  disabled,
  icon,
  label,
  sprite,
  onPress,
  styles,
  testID,
}: CircularButtonProps) {
  const colors = useThemeColors();

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        !disabled && styles.activeActionButton,
        disabled && styles.disabledButton,
        pressed && styles.pressed,
      ]}
      testID={testID}
    >
      {sprite ? (
        <Text style={styles.actionSprite} testID={`${testID}-sprite`}>
          {sprite}
        </Text>
      ) : icon ? (
        <FontAwesome color={colors.ink} name={icon} size={14} />
      ) : null}
      {label ? (
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          numberOfLines={2}
          style={styles.actionText}
        >
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

type ArrowButtonProps = {
  color: string;
  direction: Direction;
  disabled: boolean;
  playerAction: (action: PlayerAction) => void;
  styles: ReturnType<typeof createStyles>;
};

function ArrowButton({
  color,
  direction,
  disabled,
  playerAction,
  styles,
}: ArrowButtonProps) {
  return (
    <Pressable
      accessibilityLabel={`Move ${direction}`}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => playerAction(`move-${direction}`)}
      style={({ pressed }) => [
        styles.arrowButton,
        disabled && styles.disabledButton,
        pressed && styles.pressed,
      ]}
    >
      <FontAwesome
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
      fontSize: 12,
      fontWeight: "900",
      lineHeight: 14,
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
      fontSize: 13,
      fontWeight: "900",
      lineHeight: 12,
      textAlign: "center",
    },
    actionSprite: {
      fontSize: 16,
      lineHeight: 18,
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
