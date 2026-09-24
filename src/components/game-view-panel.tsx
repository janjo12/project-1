import { type ReactNode, useSyncExternalStore } from "react";
import { createSceneFrameStore, type SceneFrameStore } from "@/utils/scene-frame-store";
//#region imports
import { StyleSheet, Text, View } from "react-native";

import {
  getBounceOffset,
  RoomScene,
  type RoomDoorways,
  type RoomSceneActor,
  type ScenePosition,
} from "@/components/room-scene";
import { useThemeColors, type ThemeColors } from "@/components/theme";
import {
  type CombatAnimationFrame,
} from "@/entities";
//#endregion

//#region types
export type { RoomDoorways, RoomSceneActor, ScenePosition };

type GameViewPanelProps = {
  canUnlockDoors?: boolean;
  animationFrame?: CombatAnimationFrame;
  sceneFrameStore?: SceneFrameStore;
  floorLayer?: ReactNode;
  enemyHealthLossAmount?: number;
  hardTurnCounter?: number | null;
  playerPosition?: ScenePosition;
  playerLabel?: string;
  playerSprite?: string;
  roomDoorways?: RoomDoorways;
  roomSceneActors?: RoomSceneActor[];
  playerEnergyLossAmount?: number;
  playerHealthLossAmount?: number;
  disabled?: boolean;
  onActorPress?: (actor: RoomSceneActor) => void;
  onDoorwayPress?: (position: Exclude<ScenePosition, "center">) => void;
  onPlayerPress?: () => void;
  roomId?: string;
  reducedMotion?: boolean;
};
//#endregion

const fallbackFrameStore = createSceneFrameStore();
const PLAYER_SPRITE = "\uD83E\uDD3A";
const defaultRoomDoorways: RoomDoorways = {
  bottom: "wall",
  left: "wall",
  right: "wall",
  top: "wall",
};

export function GameViewPanel({
  canUnlockDoors = false,
  floorLayer,
  animationFrame: suppliedFrame,
  sceneFrameStore = fallbackFrameStore,
  enemyHealthLossAmount = 0,
  hardTurnCounter = null,
  playerPosition = "center",
  playerLabel = "Player",
  playerSprite = PLAYER_SPRITE,
  roomDoorways = defaultRoomDoorways,
  roomSceneActors,
  playerEnergyLossAmount = 0,
  playerHealthLossAmount = 0,
  disabled = false,
  onActorPress,
  onDoorwayPress,
  onPlayerPress,
  roomId,
  reducedMotion,
}: GameViewPanelProps) {
  const storedFrame = useSyncExternalStore(sceneFrameStore.subscribe, sceneFrameStore.getSnapshot, sceneFrameStore.getSnapshot);
  const animationFrame = suppliedFrame ?? storedFrame;
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const visibleActors = roomSceneActors ?? [];
  const bounceOffset = getBounceOffset(animationFrame.bounceElapsed);
  const sceneScale = 1;

  return (
    <View style={styles.panel}>
      <View style={styles.sceneBox}>
        {hardTurnCounter !== null ? (
          <Text
            accessibilityLabel="Turns remaining"
            style={styles.turnCounter}
            testID="hard-turn-counter"
          >
            Reach the Stairs in {hardTurnCounter} Turns
          </Text>
        ) : null}

        <RoomScene
          actors={visibleActors}
          roomId={roomId}
          reducedMotion={reducedMotion}
          floorLayer={floorLayer}
          animationFrame={animationFrame}
          bounceOffset={bounceOffset}
          doorways={roomDoorways}
          enemyHealthLossAmount={enemyHealthLossAmount}
          playerEnergyLossAmount={playerEnergyLossAmount}
          playerHealthLossAmount={playerHealthLossAmount}
          playerPosition={playerPosition}
          playerLabel={playerLabel}
          playerSprite={playerSprite}
          sceneScale={sceneScale}
          canUnlockDoors={canUnlockDoors}
          disabled={disabled}
          onActorPress={onActorPress}
          onDoorwayPress={onDoorwayPress}
          onPlayerPress={onPlayerPress}
        />
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    panel: {
      backgroundColor: "transparent",
      flexGrow: 1,
      gap: 6,
      justifyContent: "flex-end",
    },
    sceneBox: {
      alignItems: "center",
      backgroundColor: "transparent",
      gap: 8,
      justifyContent: "center",
      minHeight: 224,
      padding: 14,
    },
    turnCounter: {
      color: colors.ink,
      fontSize: 18,
      fontVariant: ["tabular-nums"],
      fontWeight: "900",
      lineHeight: 22,
      textAlign: "center",
    },
  });
}
