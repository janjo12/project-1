import { PixelSprite } from "@/components/Common/PixelSprite";

import { Pressable, Text, View, type TextStyle } from "react-native";

import { createStyles } from "@/components/Dungeon/room-scene-styles";
import { useThemeColors } from "@/components/Common/theme";

export type DoorPosition = "top" | "right" | "bottom" | "left";
export type DoorState = "guarded" | "locked" | "open" | "wall";
export type RoomDoorways = Record<DoorPosition, DoorState>;

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
  canPassBlockedDoorways = false,
) {
  // Ghosts can pass through locked or guarded doors while walls remain impassable.
  return !disabled && (state === "open" || (state === "locked" && canUnlockDoors) || (canPassBlockedDoorways && (state === "locked" || state === "guarded")));
}

export function RoomWalls({
  canUnlockDoors,
  canPassBlockedDoorways = false,
  disabled,
  doorways,
  playerPosition = "center",
  onPress,
  reducedMotion = false,
  animationsPaused = false,
  showMoveHints = false,
}: {
  canUnlockDoors: boolean;
  canPassBlockedDoorways?: boolean;
  disabled: boolean;
  doorways: RoomDoorways;
  playerPosition?: DoorPosition | "center";
  onPress?: (position: DoorPosition) => void;
  reducedMotion?: boolean;
  animationsPaused?: boolean;
  showMoveHints?: boolean;
}) {
  const styles = createStyles(useThemeColors());
  const positions: DoorPosition[] = ["top", "right", "bottom", "left"];
  const arrowMotionStyle = (position: DoorPosition) =>
    !reducedMotion
      ? ({
          animationName: DOOR_ARROW_MOTION[position],
          animationDuration: "900ms",
          animationDirection: "alternate",
          animationIterationCount: "infinite",
          animationTimingFunction: "ease-in-out",
          animationPlayState: animationsPaused ? "paused" : "running",
        } as unknown as TextStyle)
      : null;

  return (
    <>
      {positions.map((position) => {
        const state = doorways[position];
        const isDisabled = !canPressDoorway(state, canUnlockDoors, disabled, canPassBlockedDoorways);

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
            pointerEvents={isDisabled ? "none" : "auto"}
            style={({ pressed }) => [
              styles.doorwayGap,
              position === "top" || position === "bottom"
                ? styles.horizontalDoorwayGap
                : styles.verticalDoorwayGap,
              position === "top" && styles.topDoorwayGap,
              position === "bottom" && styles.bottomDoorwayGap,
              position === "left" && styles.leftDoorwayGap,
              position === "right" && styles.rightDoorwayGap,
              position === playerPosition && (position === "top" || position === "bottom" ? { height: 24 } : { width: 24 }),
              pressed && styles.pressedActor,
            ]}
          >
            {showMoveHints && !isDisabled ? <Text pointerEvents="none" testID="tutorial-move" style={{ position: "absolute", bottom: "100%", backgroundColor: "#fff7cc", borderColor: "#8a5a00", borderWidth: 1, color: "#5b3a00", fontSize: 10, fontWeight: "900", lineHeight: 12, paddingHorizontal: 3 }}>Move</Text> : null}
            {state === "open" ? (
              <Text
                accessible={false}
                style={[
                  styles.doorwayArrow,
                  arrowMotionStyle(position),
                ]}
              >
                {DOOR_ARROWS[position]}
              </Text>
            ) : state === "locked" ? <Text accessible={false} style={[styles.doorwayIcon, styles.lockedDoorwayIcon]}>🔒</Text> : null}
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

