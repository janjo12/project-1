
import { StyleSheet } from "react-native";

import type { ThemeColors } from "@/components/Common/theme";

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
      // The visual sprite can extend beyond its packed layout cell after scaling,
      // so the press target covers the full 80px actor envelope.
      minWidth: 80,
      minHeight: 80,
    },
    pressedActor: {
      opacity: 0.7,
    },
    doorwayGap: {
      alignItems: "center",
      backgroundColor: "transparent",
      justifyContent: "center",
      position: "absolute",
      zIndex: 6,
    },
    doorwayIcon: {
      fontSize: 17,
      fontWeight: "900",
      lineHeight: 20,
      textAlign: "center",
    },
    doorwayArrow: {
      color: colors.accent,
      fontSize: 32,
      fontWeight: "900",
      lineHeight: 38,
      textAlign: "center",
    },
    bottomDoorwayGap: {
      bottom: 0,
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
      height: 56,
      left: "36%",
      width: "28%",
    },
    leftDoorwayGap: {
      left: 0,
    },
    lockedDoorwayIcon: {
      color: colors.ink,
    },
    rightDoorwayGap: {
      right: 0,
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
    topDoorwayGap: {
      top: 0,
    },
    verticalDoorwayGap: {
      height: "24%",
      top: "38%",
      width: 56,
    },
  });
}
