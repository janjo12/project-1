import { StyleSheet } from "react-native";

import type { ThemeColors } from "@/components/theme";

export function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    actorContent: {
      alignItems: "center",
      justifyContent: "center",
    },
    actorPosition: {
      alignItems: "center",
      justifyContent: "center",
      position: "absolute",
    },
    pressedActor: {
      opacity: 0.7,
    },
    doorwayGap: {
      alignItems: "center",
      backgroundColor: colors.paper,
      justifyContent: "center",
      position: "absolute",
      zIndex: 3,
    },
    doorwayIcon: {
      fontSize: 17,
      fontWeight: "900",
      lineHeight: 20,
      textAlign: "center",
    },
    bottomDoorwayGap: {
      bottom: -7,
    },
    enemyHealthBarFill: {
      height: "100%",
    },
    enemyHealthBarTrack: {
      backgroundColor: "rgba(239, 68, 68, 0.18)",
      height: 4,
      left: 7,
      overflow: "hidden",
      top: 3,
      width: 56,
    },
    floatingLoss: {
      alignItems: "center",
      flexDirection: "row",
      gap: 4,
      justifyContent: "center",
      position: "absolute",
      top: -4,
      zIndex: 2,
    },
    floatingLossText: {
      fontSize: 18,
      fontWeight: "900",
    },
    guardedDoorwayIcon: {
      color: "#dc2626",
    },
    horizontalDoorwayGap: {
      height: 12,
      left: "42%",
      width: "16%",
    },
    leftDoorwayGap: {
      left: -7,
    },
    lockedDoorwayIcon: {
      color: colors.ink,
    },
    rightDoorwayGap: {
      right: -7,
    },
    sceneArea: {
      borderColor: colors.ink,
      borderWidth: 5,
      height: 220,
      overflow: "visible",
      position: "relative",
      width: "100%",
    },
    sprite: {
      fontSize: 64,
    },
    topDoorwayGap: {
      top: -7,
    },
    verticalDoorwayGap: {
      height: "20%",
      top: "40%",
      width: 12,
    },
  });
}


