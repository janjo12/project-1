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
  createCombatAnimationFrame,
  type CombatAnimationFrame,
} from "@/entities";
//#endregion

//#region types
export type { RoomDoorways, RoomSceneActor, ScenePosition };

type GameViewPanelProps = {
  canUnlockDoors?: boolean;
  animationFrame?: CombatAnimationFrame;
  enemyHealthLossAmount?: number;
  hardTurnCounter?: number | null;
  playerPosition?: ScenePosition;
  roomDoorways?: RoomDoorways;
  roomSceneActors?: RoomSceneActor[];
  playerEnergyLossAmount?: number;
  playerHealthLossAmount?: number;
  disabled?: boolean;
  onActorPress?: (actor: RoomSceneActor) => void;
  onDoorwayPress?: (position: Exclude<ScenePosition, "center">) => void;
  onPlayerPress?: () => void;
};
//#endregion

const PLAYER_SPRITE = "\uD83E\uDD3A";
const defaultRoomDoorways: RoomDoorways = {
  bottom: "wall",
  left: "wall",
  right: "wall",
  top: "wall",
};

export function GameViewPanel({
  canUnlockDoors = false,
  animationFrame = createCombatAnimationFrame(),
  enemyHealthLossAmount = 0,
  hardTurnCounter = null,
  playerPosition = "center",
  roomDoorways = defaultRoomDoorways,
  roomSceneActors,
  playerEnergyLossAmount = 0,
  playerHealthLossAmount = 0,
  disabled = false,
  onActorPress,
  onDoorwayPress,
  onPlayerPress,
}: GameViewPanelProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const visibleActors = roomSceneActors ?? [];
  const bounceOffset = getBounceOffset(animationFrame.bounceElapsed);
  const sceneScale = getSceneScale(visibleActors.length + 1);

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
          animationFrame={animationFrame}
          bounceOffset={bounceOffset}
          doorways={roomDoorways}
          enemyHealthLossAmount={enemyHealthLossAmount}
          playerEnergyLossAmount={playerEnergyLossAmount}
          playerHealthLossAmount={playerHealthLossAmount}
          playerPosition={playerPosition}
          playerSprite={PLAYER_SPRITE}
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

function getSceneScale(actorCount: number) {
  if (actorCount <= 2) {
    return 1;
  }

  if (actorCount === 3) {
    return 0.92;
  }

  if (actorCount === 4) {
    return 0.84;
  }

  if (actorCount === 5) {
    return 0.78;
  }

  return 0.72;
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
