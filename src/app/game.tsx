//#region imports
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert } from "react-native";
import { GameEngine } from "react-native-game-engine";

import { Container, Header, Row, StyledModal, Title } from "@/components/displays";
import { DungeonMap } from "@/components/dungeon-map";
import { ActionControls, type PlayerAction } from "@/components/game-controls";
import { GameViewPanel } from "@/components/game-view-panel";
import { DestructiveButton, NormalButton, PrimaryButton, ToggleButton } from "@/components/inputs";
import { DebugBar, ResourceBar, ResourceBarGroup } from "@/components/resource-bar";
import { ScreenShell } from "@/components/screen-shell";
import { ThemeProvider, useThemeColors } from "@/components/theme";

import {
  GameLoopTimer,
  PLAYER_MAX_ENERGY,
  PLAYER_MAX_HEALTH,
  runGameLoop,
  useRunGame,
} from "@/hooks/run-game";
import { useGameSettings } from "@/hooks/use-game-settings";
import type { GameSettings } from "@/utils/settings-storage";
//#endregion

//#region types
type PauseMenuProps = {
  onBackToGame: () => void;
  onQuitToTitle: () => void;
  onSettingsChange: (settings: Partial<GameSettings>) => void;
  settings: GameSettings;
  visible: boolean;
};

type GameContentProps = {
  onSettingsChange: (settings: Partial<GameSettings>) => void;
  settings: GameSettings;
};
//#endregion

export default function GameScreen() {
  const { isLoading, settings, updateSettings } = useGameSettings();

  if (isLoading) {
    return null;
  }

  return (
    <ThemeProvider appearance={settings.appearance}>
      <GameContent settings={settings} onSettingsChange={updateSettings} />
    </ThemeProvider>
  );
}

function GameContent({ onSettingsChange, settings }: GameContentProps) {
  const isLeftHanded = settings.handedness === "left";
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const colors = useThemeColors();
  const game = useRunGame({
    difficulty: settings.difficulty,
    onGameOver: (score) =>
      router.replace({
        pathname: "/game-over",
        params: { score: String(score) },
      }),
    seed: settings.seed.trim(),
    vibrationEnabled: settings.vibrationEnabled,
  });
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
  const map = (
    <DungeonMap currentRoomId={game.currentRoomId} map={game.dungeonMap} />
  );
  const controls = (
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
  );

  function confirmQuitToTitle() {
    Alert.alert("Quit to Title?", "Your current run will be lost.", [
      { style: "cancel", text: "Cancel" },
      {
        onPress: () => {
          setIsMenuOpen(false);
          router.replace("/");
        },
        style: "destructive",
        text: "Quit",
      },
    ]);
  }

  return (
    <ScreenShell compact>
      <GameEngine
        key={game.turnNumber}
        entities={gameLoopEntities}
        renderer={() => null}
        running={game.isGameLoopRunning() && !isMenuOpen}
        systems={[runGameLoop]}
        timer={new GameLoopTimer()}
      />

      <Header>
        <NormalButton
          accessibilityLabel="Menu"
          accessibilityRole="button"
          label="Menu"
          onPress={() => setIsMenuOpen(true)}
        />
      </Header>

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

      <ResourceBarGroup>
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
            color={colors.timer}
            current={game.turnTimeRemaining}
            icon="hourglass-half"
            max={game.turnDuration}
            panelPosition="last"
            testID="turn-timer"
          />
        ) : null}
      </ResourceBarGroup>

      <DebugBar accessibilityLabel="Turn status" accessibilityRole="text">
        {game.turnStatus}
      </DebugBar>

      <Row>
        {isLeftHanded ? controls : map}
        {isLeftHanded ? map : controls}
      </Row>

      <PauseMenu
        onBackToGame={() => setIsMenuOpen(false)}
        onQuitToTitle={confirmQuitToTitle}
        onSettingsChange={onSettingsChange}
        settings={settings}
        visible={isMenuOpen}
      />
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

export function PauseMenu({
  onBackToGame,
  onQuitToTitle,
  onSettingsChange,
  settings,
  visible,
}: PauseMenuProps) {
  return (
    <StyledModal
      accessibilityLabel="Game menu"
      accessibilityRole="dialog"
      animationType="fade"
      onRequestClose={onBackToGame}
      visible={visible}
    >
      <Title>Menu</Title>

      <Container>
        <ToggleButton
          label="Dark Mode"
          value={settings.appearance === "dark"}
          onValueChange={(value) => {
            onSettingsChange({ appearance: value ? "dark" : "light" });
          }}
        />
        <ToggleButton
          label="Vibration"
          value={settings.vibrationEnabled}
          onValueChange={(value) => {
            onSettingsChange({ vibrationEnabled: value });
          }}
        />
      </Container>

      <PrimaryButton 
        accessibilityLabel="Back to Game"
        accessibilityRole="button"
        label="Back to Game"
        onPress={onBackToGame}
      />

      <DestructiveButton
        accessibilityLabel="Quit to Title"
        accessibilityRole="button"
        label="Quit to Title"
        onPress={onQuitToTitle}
      />
    </StyledModal>
  );
}