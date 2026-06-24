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

export type Enemy = {
  sprite: string;
  hitPoints: number;
  name: string;
};

type GameViewPanelProps = {
  animationFrame?: CombatAnimationFrame;
  enemy?: Enemy | null;
  enemyHealthLossAmount?: number;
  enemyMaxHitPoints?: number;
  floorItem?: string | null;
  floorStairs?: boolean;
  hardTurnCounter?: number | null;
  playerPosition?: ScenePosition;
  roomDoorways?: RoomDoorways;
  roomSceneActors?: RoomSceneActor[];
  playerEnergyLossAmount?: number;
  playerHealthLossAmount?: number;
};
//#endregion

const PLAYER_SPRITE = "\uD83E\uDD3A";
const STAIRS_SPRITE = "\uD83E\uDE9C";
const defaultRoomDoorways: RoomDoorways = {
  bottom: "wall",
  left: "wall",
  right: "wall",
  top: "wall",
};

export function GameViewPanel({
  animationFrame = createCombatAnimationFrame(),
  enemy = null,
  enemyHealthLossAmount = 0,
  enemyMaxHitPoints = enemy?.hitPoints ?? 1,
  floorItem = null,
  floorStairs = false,
  hardTurnCounter = null,
  playerPosition = "center",
  roomDoorways = defaultRoomDoorways,
  roomSceneActors,
  playerEnergyLossAmount = 0,
  playerHealthLossAmount = 0,
}: GameViewPanelProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const visibleActors = roomSceneActors ?? createSceneActors({
    enemy,
    enemyMaxHitPoints,
    floorItem,
    floorStairs,
  });
  const bounceOffset = getBounceOffset(animationFrame.bounceElapsed);
  const sceneScale = getSceneScale(visibleActors.length + 1);

  return (
    <View style={styles.panel}>
      <View style={styles.sceneBox}>
        {hardTurnCounter !== null ? (
          <Text
            accessibilityLabel="Hard mode turns remaining"
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
          enemyMaxHitPoints={enemyMaxHitPoints}
          playerEnergyLossAmount={playerEnergyLossAmount}
          playerHealthLossAmount={playerHealthLossAmount}
          playerPosition={playerPosition}
          playerSprite={PLAYER_SPRITE}
          sceneScale={sceneScale}
        />
      </View>
    </View>
  );
}

function createSceneActors({
  enemy,
  enemyMaxHitPoints,
  floorItem,
  floorStairs,
}: Pick<GameViewPanelProps, "enemy" | "enemyMaxHitPoints" | "floorItem" | "floorStairs">) {
  const actors: RoomSceneActor[] = [];

  if (enemy) {
    actors.push({
      currentHealth: enemy.hitPoints,
      sprite: enemy.sprite,
      kind: "enemy",
      label: enemy.name,
      maxHealth: enemyMaxHitPoints ?? enemy.hitPoints,
    });
  }

  if (floorStairs) {
    actors.push({
      sprite: STAIRS_SPRITE,
      kind: "stairs",
      label: "Stairs",
      position: "center",
    });
  }

  if (floorItem && !enemy) {
    actors.push({
      sprite: floorItem,
      kind: "item",
      label: "Floor item",
      position: "center",
    });
  }

  return actors;
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
      gap: 6,
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
