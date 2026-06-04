import { StyleSheet, View } from "react-native";

export function DungeonMapPlaceholder() {
  return <View style={styles.wrapper} testID="dungeon-map-placeholder" />;
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    gap: 6,
    minHeight: 300,
  },
});
