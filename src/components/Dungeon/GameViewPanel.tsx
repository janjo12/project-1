import type { SceneFrameStore } from "@/game/state/sceneFrameStore";
import { useEffect, useState, type ReactNode } from "react";
import { Animated, Platform, StyleSheet, Text, View } from "react-native";

import { useThemeColors, type ThemeColors } from "@/components/Common/theme";
import {
  RoomScene,
  type RoomDoorways,
  type RoomSceneActor,
  type ScenePosition,
  type ScreenPoint,
  type SupportEffect,
} from "@/components/Dungeon/Room";
import {
  type CombatAnimationFrame,
} from "@/game/entities";
export type { RoomDoorways, RoomSceneActor, ScenePosition, ScreenPoint, SupportEffect };

type GameViewPanelProps = {
  canUnlockDoors?: boolean;
  canPassBlockedDoorways?: boolean;
  animationFrame?: CombatAnimationFrame;
  sceneFrameStore?: SceneFrameStore;
  floorLayer?: ReactNode;
  enemyHealthLossAmount?: number;
  hardTurnCounter?: number | null;
  showStairsObjective?: boolean;
  showMoveHints?: boolean;
  showAttackHints?: boolean;
  showGetHint?: boolean;
  supportEffect?: SupportEffect | null;
  playerPosition?: ScenePosition;
  playerLabel?: string;
  playerSprite?: string;
  playerAuraColor?: string;
  roomDoorways?: RoomDoorways;
  roomSceneActors?: RoomSceneActor[];
  playerEnergyLossAmount?: number;
  playerHealthLossAmount?: number;
  disabled?: boolean;
  onActorPress?: (actor: RoomSceneActor, source?: ScreenPoint) => void;
  onDoorwayPress?: (position: Exclude<ScenePosition, "center">) => void;
  onPlayerPress?: () => void;
  roomId?: string;
  reducedMotion?: boolean;
  pauseAnimations?: boolean;
};

const PLAYER_SPRITE = "warrior_graphic";
const defaultRoomDoorways: RoomDoorways = {
  bottom: "wall",
  left: "wall",
  right: "wall",
  top: "wall",
};

export function GameViewPanel({
  canUnlockDoors = false,
  canPassBlockedDoorways = false,
  floorLayer,
  animationFrame: suppliedFrame,
  sceneFrameStore,
  enemyHealthLossAmount = 0,
  hardTurnCounter = null,
  showStairsObjective = false,
  showMoveHints = false,
  showAttackHints = false,
  showGetHint = false,
  supportEffect = null,
  playerPosition = "center",
  playerLabel = "Player",
  playerSprite = PLAYER_SPRITE,
  playerAuraColor,
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
  pauseAnimations = false,
}: GameViewPanelProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const visibleActors = roomSceneActors ?? [];
  const [sceneBoxHeight, setSceneBoxHeight] = useState(0);
  const sceneScale = 1;
  const [panelOpacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const animation = Animated.timing(panelOpacity, {
      toValue: pauseAnimations ? 0.16 : 1,
      duration: 180,
      useNativeDriver: Platform.OS !== "web",
    });
    animation.start();
    return () => animation.stop();
  }, [panelOpacity, pauseAnimations]);

  return (
    <Animated.View style={[styles.panel, { opacity: panelOpacity }]}>
      <View style={[styles.sceneBox, Platform.OS === "web" && styles.webSceneBox]} onLayout={event => setSceneBoxHeight(event.nativeEvent.layout.height)}>
        {showStairsObjective || hardTurnCounter !== null ? (
          <Text
            accessibilityLabel={hardTurnCounter !== null ? "Turns remaining" : "Level objective"}
            style={styles.turnCounter}
            testID="hard-turn-counter"
          >
            {hardTurnCounter !== null
              ? `Reach the Stairs in ${hardTurnCounter} ${hardTurnCounter === 1 ? "Turn" : "Turns"}`
              : "Find the Stairs to Reach the Next Level"}
          </Text>
        ) : null}

        <RoomScene
          actors={visibleActors}
          roomId={roomId}
          maxHeight={sceneBoxHeight || undefined}
          reducedMotion={reducedMotion}
          animationsPaused={pauseAnimations}
          floorLayer={floorLayer}
          animationFrame={suppliedFrame}
          sceneFrameStore={sceneFrameStore}
          doorways={roomDoorways}
          enemyHealthLossAmount={enemyHealthLossAmount}
          playerEnergyLossAmount={playerEnergyLossAmount}
          playerHealthLossAmount={playerHealthLossAmount}
          playerPosition={playerPosition}
          playerLabel={playerLabel}
          playerSprite={playerSprite}
          playerAuraColor={playerAuraColor}
          sceneScale={sceneScale}
          canUnlockDoors={canUnlockDoors}
          canPassBlockedDoorways={canPassBlockedDoorways}
          disabled={disabled}
          onActorPress={onActorPress}
          onDoorwayPress={onDoorwayPress}
          showMoveHints={showMoveHints}
          showAttackHints={showAttackHints}
          showGetHint={showGetHint}
          supportEffect={supportEffect}
          onPlayerPress={onPlayerPress}
        />
      </View>
    </Animated.View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    panel: {
      backgroundColor: "transparent",
      flex: 1,
      minHeight: 0,
      gap: 2,
      justifyContent: "center",
    },
    sceneBox: {
      alignItems: "center",
      backgroundColor: "transparent",
      gap: 8,
      justifyContent: "center",
      minHeight: 0,
      flex: 1,
      padding: 4,
    },
    webSceneBox: {
      paddingBottom: 24,
    },
    turnCounter: {
      color: colors.ink,
      fontSize: 14,
      fontVariant: ["tabular-nums"],
      fontWeight: "900",
      lineHeight: 16,
      textAlign: "center",
    },
  });
}
