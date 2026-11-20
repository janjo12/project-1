import { PixelSprite } from "@/components/Common/PixelSprite";
import { Pressable, Text, View } from "react-native";

import { TutorialSpeechBubble } from "@/components/Common/TutorialSpeechBubble";
import { DoorwayArrow, getDoorwayPlayerOffset, type DoorPosition } from "@/components/Dungeon/DoorwayArrow";
import { createStyles } from "@/components/Dungeon/room-scene-styles";
import { useThemeColors } from "@/components/Common/theme";

export type { DoorPosition } from "@/components/Dungeon/DoorwayArrow";
export type DoorState = "guarded" | "locked" | "open" | "wall";
export type RoomDoorways = Record<DoorPosition, DoorState>;

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
              getDoorwayPlayerOffset(position, playerPosition),
              pressed && styles.pressedActor,
            ]}
          >
            {showMoveHints && !isDisabled ? <View pointerEvents="none" style={{ position: "absolute", bottom: "100%" }}><TutorialSpeechBubble label="Move" testID="tutorial-move" reducedMotion={reducedMotion} animationsPaused={animationsPaused} /></View> : null}
            {state === "open" ? (
              <DoorwayArrow animationsPaused={animationsPaused} position={position} reducedMotion={reducedMotion} style={styles.doorwayArrow} />
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
