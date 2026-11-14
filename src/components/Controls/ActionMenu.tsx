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

  if (!itemLabel) return <View ref={targetRef} accessible={false} pointerEvents="none" style={{ flex: 1, minWidth: 0, height: 72, opacity: 0 }} testID="item-flight-target" />;

  return <Pressable accessibilityRole="button" accessibilityLabel={itemLabel} accessibilityHint="Open item details" onPress={onPress} style={styles.itemPanel}>
    <View ref={targetRef} style={styles.slotContents} testID="item-status">
      {itemSprite ? <PixelSprite sprite={itemSprite} label={itemLabel} size={32} /> : null}
      <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.78} style={styles.label}>{itemLabel}</Text>
    </View>
  </Pressable>;
}

export function EquipmentControl({ label, sprite, onPress, disabled = false, targetRef }: {
  label?: string | null; sprite?: string | null; onPress?: () => void; disabled?: boolean; targetRef?: Ref<ViewInstance>;
}) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  if (!label) return <View ref={targetRef} accessible={false} pointerEvents="none" style={{ flex: 1, alignItems: "center", justifyContent: "center", height: 72, opacity: 0 }} testID="equipment-flight-target" />;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Open equipment details" disabled={disabled} onPress={onPress}
      testID="equipment-slot" style={[styles.equipmentPanel, { backgroundColor: colors.paperLight,
      borderColor: colors.sepia, opacity: disabled ? 0.5 : 1 }]}>
    <View ref={targetRef} style={styles.slotContents} testID="equipment-status">
      {sprite ? <PixelSprite sprite={sprite} label={label} size={32} /> : null}
      <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.78} style={[styles.label, { color: colors.ink }]}>{label}</Text>
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
        flex: 1, minWidth: 0, minHeight: 48, borderRadius: 12, padding: 4,
        justifyContent: "center", alignItems: "center",
        backgroundColor: charged ? "#14532d" : "#21833e",
        borderColor: charged ? "#a3e635" : "#166534",
        borderWidth: 2, opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
      })}
    >
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: "white", fontSize: 15, fontWeight: "800", textAlign: "center" }}>
        {charged ? "Charged ⚡ · Cancel" : "Charge Up ⚡"}
      </Text>
      <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: "#ecfccb", fontSize: 10, textAlign: "center" }}>
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
      minWidth: 0,
      height: 72,
      justifyContent: "center",
      overflow: "hidden",
      padding: 2,
    },
    equipmentPanel: { flex: 1, alignItems: "center", justifyContent: "center", borderWidth: 2, borderRadius: 12, height: 72, padding: 2, overflow: "hidden" },
    slotContents: { alignItems: "center", flexDirection: "column", gap: 1, justifyContent: "center", width: "100%" },
    label: {
      color: colors.ink,
      flexShrink: 1,
      fontSize: 13,
      fontWeight: "900",
      lineHeight: 15,
      textAlign: "center",
    },
  });
}
