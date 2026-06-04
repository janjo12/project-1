import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/components/theme";

export type PlayerAction = "attack" | "defend" | "special";

type ActionControlsProps = {
  disabledActions?: PlayerAction[];
  isBusy?: boolean;
  onAction: (action: PlayerAction) => void;
};

const actions: { action: PlayerAction; label: string }[] = [
  { action: "defend", label: "Defend" },
  { action: "attack", label: "Attack" },
  { action: "special", label: "Special" },
];

const arrows = {
  down: "v",
  left: "<",
  right: ">",
  up: "^",
};

export function ActionControls({
  disabledActions = [],
  isBusy = false,
  onAction,
}: ActionControlsProps) {
  return (
    <View style={styles.container}>
      <View style={styles.actionCluster}>
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
            >
              <Text style={styles.actionText}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.dPad}>
        <View style={styles.dPadRow}>
          <View style={styles.dPadSpacer} />
          <ArrowButton direction="up" label={arrows.up} />
          <View style={styles.dPadSpacer} />
        </View>
        <View style={styles.dPadRow}>
          <ArrowButton direction="left" label={arrows.left} />
          <View style={styles.dPadCenter} />
          <ArrowButton direction="right" label={arrows.right} />
        </View>
        <View style={styles.dPadRow}>
          <View style={styles.dPadSpacer} />
          <ArrowButton direction="down" label={arrows.down} />
          <View style={styles.dPadSpacer} />
        </View>
      </View>

      <View style={styles.footerSpacer} />
    </View>
  );
}

type ArrowButtonProps = {
  direction: "down" | "left" | "right" | "up";
  label: string;
};

function ArrowButton({ direction, label }: ArrowButtonProps) {
  return (
    <Pressable
      accessibilityLabel={`Move ${direction}`}
      accessibilityRole="button"
      onPress={() => {}}
      style={({ pressed }) => [styles.arrowButton, pressed && styles.pressed]}
    >
      <Text style={styles.arrow}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 14,
    justifyContent: "space-between",
    minWidth: 126,
  },
  actionCluster: {
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
  },
  actionButton: {
    alignItems: "center",
    backgroundColor: colors.paperLight,
    borderColor: colors.sepia,
    borderRadius: 8,
    borderWidth: 2,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 12,
    width: 108,
  },
  actionText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.38,
  },
  footerSpacer: {
    minHeight: 54,
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
  arrow: {
    color: colors.ink,
    fontSize: 25,
    fontWeight: "800",
    lineHeight: 28,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.72,
  },
});
