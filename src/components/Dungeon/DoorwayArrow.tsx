import type { StyleProp, TextStyle, ViewStyle } from "react-native";
import Animated from "react-native-reanimated";

export type DoorPosition = "top" | "right" | "bottom" | "left";

const DOOR_ARROWS: Record<DoorPosition, string> = {
  top: "⬆︎",
  right: "➡︎",
  bottom: "⬇︎",
  left: "⬅︎",
};

export const DOORWAY_ARROW_BOB_DISTANCE = 2.5;
export const DOORWAY_ARROW_SIZE = 48;
export const DOORWAY_ARROW_EDGE_OFFSET = 12;
const BOB_DISTANCE = DOORWAY_ARROW_BOB_DISTANCE;
export function getDoorwayArrowEdgeOffset(position: DoorPosition): ViewStyle {
  if (position === "top") return { transform: [{ translateY: -DOORWAY_ARROW_EDGE_OFFSET }] };
  if (position === "bottom") return { transform: [{ translateY: DOORWAY_ARROW_EDGE_OFFSET }] };
  if (position === "left") return { transform: [{ translateX: -DOORWAY_ARROW_EDGE_OFFSET }] };
  return { transform: [{ translateX: DOORWAY_ARROW_EDGE_OFFSET }] };
}
const DOOR_ARROW_MOTION = {
  top: { from: { transform: [{ translateY: -DOORWAY_ARROW_EDGE_OFFSET + BOB_DISTANCE }] }, to: { transform: [{ translateY: -DOORWAY_ARROW_EDGE_OFFSET - BOB_DISTANCE }] } },
  right: { from: { transform: [{ translateX: DOORWAY_ARROW_EDGE_OFFSET - BOB_DISTANCE }] }, to: { transform: [{ translateX: DOORWAY_ARROW_EDGE_OFFSET + BOB_DISTANCE }] } },
  bottom: { from: { transform: [{ translateY: DOORWAY_ARROW_EDGE_OFFSET - BOB_DISTANCE }] }, to: { transform: [{ translateY: DOORWAY_ARROW_EDGE_OFFSET + BOB_DISTANCE }] } },
  left: { from: { transform: [{ translateX: -DOORWAY_ARROW_EDGE_OFFSET + BOB_DISTANCE }] }, to: { transform: [{ translateX: -DOORWAY_ARROW_EDGE_OFFSET - BOB_DISTANCE }] } },
};

export function getDoorwayPlayerOffset(position: DoorPosition, playerPosition: DoorPosition | "center"): ViewStyle | undefined {
  if (position !== playerPosition) return undefined;
  if (position === "top") return { height: 8, top: 28 };
  if (position === "bottom") return { height: 8, bottom: 28 };
  if (position === "left") return { width: 8, left: 28 };
  return { width: 8, right: 28 };
}

export function DoorwayArrow({ position, reducedMotion, animationsPaused, style }: {
  position: DoorPosition;
  reducedMotion: boolean;
  animationsPaused: boolean;
  style: StyleProp<TextStyle>;
}) {
  return (
    <Animated.View
      pointerEvents="none"
      testID={`doorway-arrow-position-${position}`}
      style={[
        !reducedMotion && ({
          animationName: DOOR_ARROW_MOTION[position],
          animationDuration: "1000ms",
          animationDirection: "alternate",
          animationIterationCount: "infinite",
          animationTimingFunction: "ease-in-out",
          animationPlayState: animationsPaused ? "paused" : "running",
        } as unknown as ViewStyle),
        getDoorwayArrowEdgeOffset(position),
      ]}
    >
      <Animated.Text
        accessible={false}
        testID={`doorway-arrow-${position}`}
        style={style}
      >
        {DOOR_ARROWS[position]}
      </Animated.Text>
    </Animated.View>
  );
}
