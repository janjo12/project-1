import { ACTOR_ENVELOPE } from "@/utils/coordinates";
import { GAME_PARAMETERS } from "@/game/config/gameparameters";
import Animated from "react-native-reanimated";
import type { ReactNode } from "react";
import type { ViewStyle } from "react-native";

export type EntryPosition = "top" | "bottom" | "left" | "right" | "center";

export function getRoomEntryOffset(position: EntryPosition): [number, number] {
  if (position === "bottom") return [0, 22];
  if (position === "top") return [0, -22];
  if (position === "right") return [22, 0];
  if (position === "left") return [-22, 0];
  return [0, 0];
}

export function getRoomEntryInset(position: EntryPosition, inset = 50): [number, number] {
  if (position === "top") return [0, inset];
  if (position === "bottom") return [0, -inset];
  if (position === "left") return [inset, 0];
  if (position === "right") return [-inset, 0];
  return [0, 0];
}

export function RoomEntryAnimation({
  children,
  entering,
  entryPosition,
  reducedMotion,
  animationsPaused,
  testID,
}: {
  children: ReactNode;
  entering: boolean;
  entryPosition: EntryPosition;
  reducedMotion: boolean;
  animationsPaused: boolean;
  testID?: string;
}) {
  const [entryX, entryY] = getRoomEntryOffset(entryPosition);
  const style = {
    width: ACTOR_ENVELOPE,
    height: ACTOR_ENVELOPE,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    ...(entering && !reducedMotion ? {
      animationName: {
        from: { transform: [{ translateX: entryX }, { translateY: entryY }] },
        to: { transform: [{ translateX: 0 }, { translateY: 0 }] },
      },
      animationDuration: `${GAME_PARAMETERS.animation.roomEntryDurationMs}ms`,
      animationTimingFunction: "ease-out",
      animationFillMode: "both",
      animationPlayState: animationsPaused ? "paused" : "running",
    } : {}),
  } as unknown as ViewStyle;

  return <Animated.View testID={testID} style={style}>{children}</Animated.View>;
}
