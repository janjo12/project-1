import { PixelSprite } from "@/components/pixel-sprite";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { type ThemeColors, useThemeColors } from "@/components/theme";

type ItemControlProps = {
  activationDescription?: string | null;
  itemLabel?: string | null;
  itemSprite?: string | null;
};

export function ItemControl({
  activationDescription = null,
  itemLabel = null,
  itemSprite = null,
}: ItemControlProps) {
  const styles = createStyles(useThemeColors());

  return (
    <View style={styles.container}>
      <View
        accessibilityLabel={itemLabel ? `${itemLabel}. ${activationDescription}` : "No item held"}
        accessibilityRole="text"
      style={[styles.itemPanel, { maxWidth: 105, minWidth: 88, minHeight: 48 }]}
        testID="item-status"
      >
        {itemSprite ? <PixelSprite sprite={itemSprite} label={itemLabel ?? "Item"} size={18} /> : null}
        <Text style={styles.label}>{itemLabel ?? "No Item"}</Text>
        <Text style={[styles.description, { fontSize: 9, lineHeight: 11 }]}>
          {activationDescription ?? "Pick up an item to hold it."}
        </Text>
      </View>
    </View>
  );
}

export function EquipmentControl({ label, description, sprite, onDrop, disabled = false }: {
  label?: string | null; description?: string | null; sprite?: string | null; onDrop?: () => void; disabled?: boolean;
}) {
  const colors = useThemeColors();
  return <Pressable accessibilityRole="button" accessibilityLabel={label ? `${label}. Drop equipment` : "Equipment slot empty"}
    accessibilityHint="Tap to drop your equipment without using a turn" disabled={disabled || !label} onPress={onDrop}
    testID="equipment-slot" style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.paperLight,
      borderColor: colors.sepia, borderWidth: 2, borderRadius: 12, minHeight: 48, padding: 6 }}>
    {sprite ? <PixelSprite sprite={sprite} label={label ?? "Equipment"} size={20} /> : null}
    <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "900" }}>{label ?? "Equipment"}</Text>
    <Text style={{ color: colors.sepia, fontSize: 9, textAlign: "center" }}>{description ?? "Tap to drop"}</Text>
  </Pressable>;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      alignItems: "center",
      justifyContent: "center",
    },
    itemPanel: {
      alignItems: "center",
      backgroundColor: colors.paperLight,
      borderColor: colors.sepia,
      borderRadius: 999,
      borderWidth: 2,
      gap: 2,
      justifyContent: "center",
      minHeight: 64,
      maxWidth: 150,
      minWidth: 120,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    description: { color: colors.sepia, fontSize: 11, lineHeight: 14, textAlign: "center" },
    label: {
      color: colors.ink,
      fontSize: 13,
      fontWeight: "900",
      textAlign: "center",
    },
    sprite: { fontSize: 20 },
  });
}

export function ChargeControl({ charged, disabled, onPress }: {
  charged: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={charged ? "Cancel Charge Up" : "Charge Up"}
      accessibilityState={{ selected: charged, disabled }}
      accessibilityHint="Reserves one energy for the next action. Press again to cancel and refund it."
      disabled={disabled}
      onPress={onPress}
      testID="charge-up-button"
      style={({ pressed }) => ({
        flex: 1, minHeight: 72, borderRadius: 12, padding: 12,
        justifyContent: "center", alignItems: "center",
        backgroundColor: charged ? "#14532d" : "#21833e",
        borderColor: charged ? "#a3e635" : "#166534",
        borderWidth: 2, opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
      })}
    >
      <Text style={{ color: "white", fontSize: 18, fontWeight: "800" }}>
        {charged ? "Charged ⚡ · Cancel" : "Charge Up ⚡"}
      </Text>
      <Text style={{ color: "#ecfccb", fontSize: 12, textAlign: "center" }}>
        {charged ? "Tap to refund 1 energy" : "Next action · 1 energy"}
      </Text>
    </Pressable>
  );
}
