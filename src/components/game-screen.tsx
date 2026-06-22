import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { GameEngine } from "react-native-game-engine";

import { ActionControls, type PlayerAction } from "@/components/action-controls";
import { DungeonMap } from "@/components/dungeon-map";
import { GameViewPanel, ResourceBar } from "@/components/game-view-panel";
import { PauseMenu } from "@/components/pause-menu";
import { ScreenShell } from "@/components/screen-shell";
import type { ThemeColors } from "@/components/theme";
import { useThemeColors } from "@/components/theme";
import {
  GameLoopTimer,
  PLAYER_MAX_ENERGY,
  PLAYER_MAX_HEALTH,
  runGameLoop,
  useRunGame,
} from "@/hooks/run-game";
import type {
  Difficulty,
  GameSettings,
  Handedness,
} from "@/utils/settings-storage";

type GameScreenProps = { // eslint-disable-line react/prop-types
  difficulty?: Difficulty;
  handedness: Handedness;
  onGameOver: (score: number) => void;
  onQuitToTitle?: () => void;
  onSettingsChange?: (settings: Partial<GameSettings>) => void;
  seed: string;
  settings?: Pick<GameSettings, "appearance" | "vibrationEnabled">;
  vibrationEnabled?: boolean;
};

const TURN_TIMER_COLOR = "#a855f7";

export function GameScreen({ // eslint-disable-line react/prop-types
  difficulty = "normal",
  handedness,
  onGameOver,
  onQuitToTitle = () => {},
  onSettingsChange = () => {},
  seed,
  settings,
  vibrationEnabled = true,
}: GameScreenProps) { // eslint-disable-line react/prop-types
  const isLeftHanded = handedness === "left";
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const game = useRunGame({ difficulty, onGameOver, seed, vibrationEnabled });
  const pauseSettings = settings ?? {
    appearance: "system" as const,
    vibrationEnabled,
  };
  const disabledActions = getDisabledActions({ // eslint-disable-line react/prop-types
    hasLost: game.hasLost,
    hasRoomEnemy: game.hasRoomEnemy,
    playerEnergy: game.playerEnergy,
  });
  const gameLoopEntities = useMemo( // eslint-disable-line react/prop-types
    () => ({
      gameLoop: {
        elapsed: 0,
        expired: false,
        isTurnClockActive: game.isTurnClockActive,
        onExpire: game.expireTurn,
        onFrame: game.updateGameFrame,
        resetKey: game.turnNumber,
        turnDuration: game.turnDuration,
      },
    }),
    [
      game.expireTurn,
      game.isTurnClockActive,
      game.turnDuration,
      game.turnNumber,
      game.updateGameFrame,
    ],
  );

  function confirmQuitToTitle() { // eslint-disable-line react/prop-types
    Alert.alert("Quit to Title?", "Your current run will be lost.", [
      { style: "cancel", text: "Cancel" },
      {
        onPress: onQuitToTitle,
        style: "destructive",
        text: "Quit",
      },
    ]);
  }

  return (
    <ScreenShell compact>
      <View style={styles.container}>
        <GameEngine
          key={game.turnNumber}
          entities={gameLoopEntities}
          renderer={() => null}
          running={game.isGameLoopRunning() && !isMenuOpen}
          style={styles.engineLoop}
          systems={[runGameLoop]}
          timer={new GameLoopTimer()}
        />

        <View
          style={[styles.header, isLeftHanded && styles.headerMirrored]}
          testID="game-header"
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => setIsMenuOpen(true)}
            style={({ pressed }) => [
              styles.menuButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.menuButtonText}>Menu</Text>
          </Pressable>
        </View>

        <GameViewPanel
          animationFrame={game.animationFrame}
          enemy={game.currentEnemy}
          enemyHealthLossAmount={game.enemyHealthLossAmount}
          enemyMaxHitPoints={game.currentEnemyMaxHitPoints}
          floorItem={game.currentRoomItemSprite}
          floorStairs={game.roomHasStairs}
          hardTurnCounter={game.hardTurnCounter}
          playerPosition={game.playerScenePosition}
          roomDoorways={game.roomDoorways}
          roomSceneActors={game.roomSceneActors}
          playerEnergyLossAmount={game.playerEnergyLossAmount}
          playerHealthLossAmount={game.playerHealthLossAmount}
        />

        <View style={styles.playerBars}>
          <ResourceBar
            accessibilityLabel="Player health"
            color={colors.health}
            current={game.playerHealth}
            icon="heart"
            max={PLAYER_MAX_HEALTH}
            panelPosition="first"
            testID="player-health-bar"
          />
          <ResourceBar
            accessibilityLabel="Player energy"
            color={colors.energy}
            current={game.playerEnergy}
            icon="bolt"
            max={PLAYER_MAX_ENERGY}
            panelPosition={game.hasTurnTimer ? "middle" : "last"}
            testID="player-energy-bar"
          />
          {game.hasTurnTimer ? (
            <ResourceBar
              accessibilityLabel="Turn timer"
              color={TURN_TIMER_COLOR}
              current={game.turnTimeRemaining}
              icon="hourglass-half"
              max={game.turnDuration}
              panelPosition="last"
              testID="turn-timer"
            />
          ) : null}
        </View>

        <Text accessibilityLabel="Turn status" style={styles.turnStatus}>
          {game.turnStatus}
        </Text>

        <View
          style={[
            styles.lowerLayout,
            isLeftHanded && styles.lowerLayoutMirrored,
          ]}
          testID="game-lower-layout"
        >
          <DungeonMap currentRoomId={game.currentRoomId} map={game.dungeonMap} />
          <ActionControls
            disabledActions={disabledActions}
            disabledDirections={game.disabledDirections}
            floorItemLabel={game.currentRoomItemLabel}
            isItemDisabled={game.isItemDisabled}
            isBusy={game.isResolving}
            itemLabel={game.inventoryItemLabel}
            itemSprite={game.inventoryItemSprite}
            nextLevelNumber={game.roomHasStairs ? game.level + 1 : null}
            playerAction={game.playerAction}
          />
        </View>

        <PauseMenu
          onBackToGame={() => setIsMenuOpen(false)}
          onQuitToTitle={confirmQuitToTitle}
          onSettingsChange={onSettingsChange}
          settings={pauseSettings}
          visible={isMenuOpen}
        />
      </View>
    </ScreenShell>
  );
}

function getDisabledActions({ // eslint-disable-line react/prop-types
  hasLost,
  hasRoomEnemy,
  playerEnergy,
}: {
  hasLost: boolean;
  hasRoomEnemy: boolean;
  playerEnergy: number;
}): PlayerAction[] {
  if (hasLost || !hasRoomEnemy) {
    return ["attack", "defend", "special"] satisfies PlayerAction[];
  }

  if (playerEnergy <= 0) {
    return ["special"] satisfies PlayerAction[];
  }

  return [] satisfies PlayerAction[];
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      gap: 10,
    },
    engineLoop: {
      height: 0,
      opacity: 0,
      width: 0,
    },
    header: {
      flexDirection: "row",
      justifyContent: "flex-start",
      minHeight: 46,
      paddingTop: 18,
    },
    headerMirrored: {
      justifyContent: "flex-end",
    },
    lowerLayout: {
      alignItems: "flex-end",
      flex: 1,
      flexDirection: "row",
      gap: 14,
      justifyContent: "space-between",
      paddingBottom: 120,
    },
    lowerLayoutMirrored: {
      flexDirection: "row-reverse",
    },
    playerBars: {
      gap: 6,
    },
    turnStatus: {
      color: colors.fadedInk,
      fontSize: 16,
      fontWeight: "900",
      minHeight: 22,
      textAlign: "center",
    },
    menuButton: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: 36,
      paddingHorizontal: 10,
    },
    menuButtonText: {
      color: colors.ink,
      fontSize: 14,
      fontWeight: "900",
    },
    pressed: {
      opacity: 0.72,
    },
  });
}
