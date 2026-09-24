import { StyleSheet } from "react-native";

import type { ThemeColors } from "@/components/theme";

export function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    actorContent: {
      alignItems: "center",
      gap: 2,
      justifyContent: "center",
    },
    actorPosition: {
      overflow: "visible",
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
    doorwayArrow: {
      color: colors.accent,
      fontSize: 14,
      fontWeight: "900",
      lineHeight: 12,
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
      overflow: "hidden",
      width: 48,
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

      overflow: "visible",
      position: "relative",
      width: "100%",
    },
    sprite: {
      fontSize: 48,
      lineHeight: 54,
    },
    actorLabel: {
      backgroundColor: colors.paperLight,
      borderColor: colors.sepia,
      borderRadius: 6,
      borderWidth: 1,
      color: colors.ink,
      fontSize: 10,
      fontWeight: "800",
      lineHeight: 13,
      maxWidth: 76,
      overflow: "hidden",
      paddingHorizontal: 4,
      textAlign: "center",
    },
    playerLabel: {
      backgroundColor: colors.paperLight,
      borderColor: colors.sepia,
      borderRadius: 6,
      borderWidth: 1,
      color: colors.ink,
      fontSize: 11,
      fontWeight: "900",
      lineHeight: 15,
      paddingHorizontal: 6,
      textAlign: "center",
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


