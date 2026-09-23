import { PixelSprite } from "@/components/pixel-sprite";
import { Pressable, Text, View } from "react-native";

import { createStyles } from "@/components/room-scene-styles";
import { useThemeColors } from "@/components/theme";

export type DoorPosition = "top" | "right" | "bottom" | "left";
export type DoorState = "guarded" | "locked" | "open" | "wall";
export type RoomDoorways = Record<DoorPosition, DoorState>;

const DOOR_GUARD_ICON = "\u274C";
const DOOR_LOCK_ICON = "\uD83D\uDD12";

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
}: {
  canUnlockDoors: boolean;
  disabled: boolean;
  doorways: RoomDoorways;
  onPress?: (position: DoorPosition) => void;
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
            accessibilityLabel={`${position} ${state} doorway`}
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
}: {
  accessibilityLabel: string;
  sprite: string;
  scale: number;
}) {
  return (
    <View style={{ transform: [{ scale }] }}>
      <PixelSprite sprite={sprite} label={accessibilityLabel} />
    </View>
  );
}
