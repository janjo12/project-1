import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { GameEngine } from "react-native-game-engine";

import { ActionControls, type PlayerAction } from "@/components/action-controls";
import { DungeonMap } from "@/components/dungeon-map";
import { PauseMenu } from "@/components/game-screen-menu";
import { GameViewPanel, ResourceBar } from "@/components/game-view-panel";
import { ScreenShell } from "@/components/screen-shell";
import type { ThemeColors } from "@/components/theme";
import { useThemeColors } from "@/components/theme";
import {
    GameLoopTimer,
    PLAYER_MAX_ENERGY,
    PLAYER_MAX_HEALTH,
    runGameLoop,
    TURN_DURATION,
    useGameRun,
} from "@/hooks/use-game-run";
import type {
    Difficulty,
    GameSettings,
    Handedness,
} from "@/utils/settings-storage";

type GameScreenProps = {
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

export function GameScreen({
  difficulty = "normal",
  handedness,
  onGameOver,
  onQuitToTitle = () => {},
  onSettingsChange = () => {},
  seed,
  settings,
  vibrationEnabled = true,
}: GameScreenProps) {
  const isLeftHanded = handedness === "left";
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const game = useGameRun({ difficulty, onGameOver, seed, vibrationEnabled });
  const pauseSettings = settings ?? {
    appearance: "system" as const,
    vibrationEnabled,
  };
  const disabledActions = getDisabledActions({
    hasLost: game.hasLost,
    hasRoomEnemy: game.hasRoomEnemy,
    playerEnergy: game.playerEnergy,
  });
  const gameLoopEntities = useMemo(
    () => ({
      gameLoop: {
        elapsed: 0,
        expired: false,
        isTurnClockActive: game.isTurnClockActive,
        onExpire: game.expireTurn,
        onFrame: game.updateGameFrame,
        resetKey: game.turnNumber,
      },
    }),
    [game.expireTurn, game.isTurnClockActive, game.turnNumber, game.updateGameFrame],
  );

  function confirmQuitToTitle() {
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
              max={TURN_DURATION}
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

function getDisabledActions({
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
    pauseActions: {
      gap: 10,
    },
    pauseBackdrop: {
      alignItems: "center",
      backgroundColor: "rgba(2, 6, 23, 0.62)",
      flex: 1,
      justifyContent: "center",
      padding: 22,
    },
    pauseButton: {
      alignItems: "center",
      backgroundColor: colors.ink,
      borderColor: colors.ink,
      borderRadius: 10,
      borderWidth: 2,
      justifyContent: "center",
      minHeight: 54,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    pauseButtonText: {
      color: colors.paper,
      fontSize: 22,
      fontWeight: "900",
      textAlign: "center",
    },
    pauseDangerButton: {
      backgroundColor: "transparent",
      borderColor: colors.health,
    },
    pauseDangerButtonText: {
      color: colors.health,
    },
    pausePanel: {
      backgroundColor: colors.paper,
      borderColor: colors.ink,
      borderRadius: 8,
      borderWidth: 3,
      gap: 28,
      maxWidth: 420,
      padding: 22,
      width: "100%",
    },
    pauseTitle: {
      color: colors.ink,
      fontSize: 34,
      fontWeight: "900",
      textAlign: "center",
    },
    pressed: {
      opacity: 0.72,
    },
  });
}