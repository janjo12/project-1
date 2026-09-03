import { StyleSheet, Text, View } from "react-native";

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
        style={styles.itemPanel}
        testID="item-status"
      >
        {itemSprite ? <Text style={styles.sprite}>{itemSprite}</Text> : null}
        <Text style={styles.label}>{itemLabel ?? "No Item"}</Text>
        <Text style={styles.description}>
          {activationDescription ?? "Pick up an item to hold it."}
        </Text>
      </View>
    </View>
  );
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
