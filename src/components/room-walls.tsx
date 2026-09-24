import { PixelSprite } from "@/components/pixel-sprite";
import Animated from "react-native-reanimated";
import { Pressable, Text, View } from "react-native";

import { createStyles } from "@/components/room-scene-styles";
import { useThemeColors } from "@/components/theme";

export type DoorPosition = "top" | "right" | "bottom" | "left";
export type DoorState = "guarded" | "locked" | "open" | "wall";
export type RoomDoorways = Record<DoorPosition, DoorState>;

const DOOR_GUARD_ICON = "\u274C";
const DOOR_LOCK_ICON = "\uD83D\uDD12";
const DOOR_ARROWS: Record<DoorPosition, string> = {
  top: "↑",
  right: "→",
  bottom: "↓",
  left: "←",
};
const DOOR_ARROW_MOTION = {
  top: { from: { transform: [{ translateY: 0 }] }, to: { transform: [{ translateY: -2 }] } },
  right: { from: { transform: [{ translateX: 0 }] }, to: { transform: [{ translateX: 2 }] } },
  bottom: { from: { transform: [{ translateY: 0 }] }, to: { transform: [{ translateY: 2 }] } },
  left: { from: { transform: [{ translateX: 0 }] }, to: { transform: [{ translateX: -2 }] } },
};

export function canPressDoorway(
  state: DoorState,
  canUnlockDoors: boolean,
  disabled = false,
) {
  return !disabled && (state === "open" || (state === "locked" && canUnlockDoors));
}

export function RoomWalls({
  canUnlockDoors,
  disabled,
  doorways,
  onPress,
  reducedMotion = false,
}: {
  canUnlockDoors: boolean;
  disabled: boolean;
  doorways: RoomDoorways;
  onPress?: (position: DoorPosition) => void;
  reducedMotion?: boolean;
}) {
  const styles = createStyles(useThemeColors());
  const positions: DoorPosition[] = ["top", "right", "bottom", "left"];

  return (
    <>
      {positions.map((position) => {
        const state = doorways[position];
        const isDisabled = !canPressDoorway(state, canUnlockDoors, disabled);

        if (state === "wall") {
          return null;
        }

        return (
          <Pressable
            accessibilityLabel={state === "open" ? `Tap ${position} doorway to move` : `${position} ${state} doorway`}
            accessibilityRole="button"
            accessibilityState={{ disabled: isDisabled }}
            disabled={isDisabled}
            key={position}
            onPress={() => onPress?.(position)}
            style={({ pressed }) => [
              styles.doorwayGap,
              position === "top" || position === "bottom"
                ? styles.horizontalDoorwayGap
                : styles.verticalDoorwayGap,
              position === "top" && styles.topDoorwayGap,
              position === "bottom" && styles.bottomDoorwayGap,
              position === "left" && styles.leftDoorwayGap,
              position === "right" && styles.rightDoorwayGap,
              pressed && styles.pressedActor,
            ]}
          >
            {state === "guarded" ? (
              <Text style={[styles.doorwayIcon, styles.guardedDoorwayIcon]}>
                {DOOR_GUARD_ICON}
              </Text>
            ) : null}
            {state === "locked" ? (
              <Text style={[styles.doorwayIcon, styles.lockedDoorwayIcon]}>
                {DOOR_LOCK_ICON}
              </Text>
            ) : null}
            {state === "open" ? (
              <Animated.Text
                accessible={false}
                style={[
                  styles.doorwayArrow,
                  !reducedMotion && {
                    animationName: DOOR_ARROW_MOTION[position],
                    animationDuration: "900ms",
                    animationDirection: "alternate",
                    animationIterationCount: "infinite",
                    animationTimingFunction: "ease-in-out",
                  },
                ]}
              >
                {DOOR_ARROWS[position]}
              </Animated.Text>
            ) : null}
          </Pressable>
        );
      })}
    </>
  );
}

export function SceneSprite({
  accessibilityLabel,
  sprite,
  scale,
  size = 48,
}: {
  accessibilityLabel: string;
  sprite: string;
  scale: number;
  size?: number;
}) {
  return (
    <View style={{ transform: [{ scale }] }}>
      <PixelSprite sprite={sprite} label={accessibilityLabel} size={size} />
    </View>
  );
}
