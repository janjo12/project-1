import { PixelSprite } from "@/components/Common/PixelSprite";
import { type Ref } from "react";
import { Pressable, StyleSheet, Text, View, type ViewInstance } from "react-native";

import { type ThemeColors, useThemeColors } from "@/components/Common/theme";

type ItemControlProps = {
  itemLabel?: string | null;
  itemSprite?: string | null;
  onPress?: () => void;
  targetRef?: Ref<ViewInstance>;
};

export function ItemControl({
  itemLabel = null,
  itemSprite = null,
  onPress,
  targetRef,
}: ItemControlProps) {
  const styles = createStyles(useThemeColors());

  if (!itemLabel) return <View ref={targetRef} accessible={false} pointerEvents="none" style={{ flex: 1, height: 72, opacity: 0 }} testID="item-flight-target" />;

  return <Pressable accessibilityRole="button" accessibilityLabel={itemLabel} accessibilityHint="Open item details" onPress={onPress} style={styles.itemPanel}>
    <View ref={targetRef} style={styles.slotContents} testID="item-status">
      {itemSprite ? <PixelSprite sprite={itemSprite} label={itemLabel} size={24} /> : null}
      <Text numberOfLines={2} style={styles.label}>{itemLabel}</Text>
    </View>
  </Pressable>;
}

export function EquipmentControl({ label, sprite, onPress, disabled = false, targetRef }: {
  label?: string | null; sprite?: string | null; onPress?: () => void; disabled?: boolean; targetRef?: Ref<ViewInstance>;
}) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  if (!label) return <View ref={targetRef} accessible={false} pointerEvents="none" style={{ flex: 1, height: 72, opacity: 0 }} testID="equipment-flight-target" />;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Open equipment details" disabled={disabled} onPress={onPress}
      testID="equipment-slot" style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.paperLight,
      borderColor: colors.sepia, borderWidth: 2, borderRadius: 12, height: 72, padding: 6, overflow: "hidden", opacity: disabled ? 0.5 : 1 }}>
    <View ref={targetRef} style={styles.slotContents} testID="equipment-status">
      {sprite ? <PixelSprite sprite={sprite} label={label} size={24} /> : null}
      <Text numberOfLines={2} style={[styles.label, { color: colors.ink }]}>{label}</Text>
    </View>
  </Pressable>;
}

export function ChargeControl({ charged, chargeCost, disabled, onPress }: {
  charged: boolean;
  chargeCost: number;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={charged ? "Cancel Charge Up" : "Charge Up"}
      accessibilityState={{ selected: charged, disabled }}
      accessibilityHint={`Reserves ${chargeCost} Energy for the next action. Press again to cancel and refund it.`}
      disabled={disabled}
      onPress={onPress}
      testID="charge-up-button"
      style={({ pressed }) => ({
        flex: 1, minHeight: 48, borderRadius: 12, padding: 6,
        justifyContent: "center", alignItems: "center",
        backgroundColor: charged ? "#14532d" : "#21833e",
        borderColor: charged ? "#a3e635" : "#166534",
        borderWidth: 2, opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
      })}
    >
      <Text style={{ color: "white", fontSize: 15, fontWeight: "800" }}>
        {charged ? "Charged ⚡ · Cancel" : "Charge Up ⚡"}
      </Text>
      <Text style={{ color: "#ecfccb", fontSize: 10, textAlign: "center" }}>
        {charged ? `Tap to refund ${chargeCost} Energy` : `Next action · ${chargeCost} Energy`}
      </Text>
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    itemPanel: {
      alignItems: "center",
      backgroundColor: colors.paperLight,
      borderColor: colors.sepia,
      borderRadius: 12,
      borderWidth: 2,
      flex: 1,
      height: 72,
      justifyContent: "center",
      overflow: "hidden",
      padding: 6,
    },
    slotContents: { alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "center", width: "100%" },
    label: {
      color: colors.ink,
      flexShrink: 1,
      fontSize: 12,
      fontWeight: "900",
      textAlign: "left",
    },
  });
}
