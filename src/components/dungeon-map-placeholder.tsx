import { StyleSheet, View } from "react-native";

import { colors } from "@/components/theme";

export function DungeonMapPlaceholder() {
  return (
    <View style={styles.wrapper}>
      <View style={styles.map}>
        <View style={[styles.room, styles.currentRoom]} />
        <View style={[styles.room, styles.roomTop]} />
        <View style={[styles.room, styles.roomLeft]} />
        <View style={[styles.room, styles.roomRight]} />
        <View style={[styles.room, styles.roomBottom]} />
        <View style={[styles.path, styles.verticalPath]} />
        <View style={[styles.path, styles.horizontalPath]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    gap: 6,
    minHeight: 300,
  },
  map: {
    alignItems: "center",
    backgroundColor: colors.paperLight,
    borderColor: colors.ink,
    borderRadius: 3,
    borderWidth: 2,
    flex: 1,
    justifyContent: "center",
    minHeight: 280,
    position: "relative",
  },
  room: {
    backgroundColor: colors.paper,
    borderColor: colors.ink,
    borderWidth: 2,
    height: 28,
    position: "absolute",
    width: 28,
    zIndex: 1,
  },
  currentRoom: {
    borderColor: colors.accent,
  },
  roomTop: {
    transform: [{ translateY: -52 }],
  },
  roomLeft: {
    transform: [{ translateX: -52 }],
  },
  roomRight: {
    transform: [{ translateX: 52 }],
  },
  roomBottom: {
    transform: [{ translateY: 52 }],
  },
  path: {
    backgroundColor: colors.ink,
    position: "absolute",
  },
  verticalPath: {
    height: 118,
    width: 3,
  },
  horizontalPath: {
    height: 3,
    width: 118,
  },
});
