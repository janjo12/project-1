//#region imports
import { router } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Alert, Text, View } from "react-native";
import { GameEngine } from "react-native-game-engine";

import { Container, Header, Row, StyledModal, Title } from "@/components/displays";
import { DungeonMap } from "@/components/dungeon-map";
import { ChargeControl, EquipmentControl, ItemControl } from "@/components/game-controls";
import { GameViewPanel, type RoomSceneActor, type ScenePosition } from "@/components/game-view-panel";
import { ClassBriefing } from "@/components/class-briefing";
import { DestructiveButton, NormalButton, PrimaryButton, ToggleButton } from "@/components/inputs";
import { DebugBar, ResourceBar, ResourceBarGroup } from "@/components/resource-bar";
import { ScreenShell } from "@/components/screen-shell";
import { ThemeProvider, useThemeColors } from "@/components/theme";

import { GAME_PARAMETERS } from "@/gameparameters";
import {
    GameLoopTimer,
    PLAYER_MAX_ENERGY,
    PLAYER_MAX_HEALTH,
    runGameLoop,
    useRunGame,
} from "@/hooks/run-game-singleplayer";
import { useGameSettings } from "@/hooks/use-game-settings";
import { MicrogameOverlay } from "@/components/microgame-overlay";
import { useMicrogame } from "@/hooks/use-microgame";
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
  const [microgameScore, setMicrogameScore] = useState<number | null>(null);
  const [classIntroPage, setClassIntroPage] = useState(0);
  const pendingAttack = useRef<string | null>(null);
  const microgame = useMicrogame(score => {
    setMicrogameScore(score);
    const target = pendingAttack.current;
    pendingAttack.current = null;
    if (target) game.attackMonster(target, score);
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
    <DungeonMap currentRoomId={game.currentRoomId} map={game.visibleDungeonMap} />
  );
  const controls = (
    <View style={{ flex: 1, gap: 4 }}>
      <EquipmentControl label={game.equipmentLabel} description={game.equipmentDescription} sprite={game.equipmentSprite} onDrop={game.dropEquipment} />
      <ItemControl activationDescription={game.inventoryItemActivationDescription} itemLabel={game.inventoryItemLabel} itemSprite={game.inventoryItemSprite} />
    </View>
  );

  function handleActorPress(actor: RoomSceneActor) {
    if (actor.kind === "enemy") {
      pendingAttack.current = actor.id;
      microgame.start(game.playerClass.microgame, settings.handedness);
    } else if (actor.kind === "item") {
      void game.pickupItem();
    } else if (actor.kind === "equipment") {
      game.pickupEquipment();
    } else {
      game.descend();
    }
  }

  function handleDoorwayPress(position: Exclude<ScenePosition, "center">) {
    const directions = {
      bottom: "south",
      left: "west",
      right: "east",
      top: "north",
    } as const;

    void game.moveToRoom(directions[position]);
  }

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
        running={game.isGameLoopRunning() && !isMenuOpen && !microgame.active && classIntroPage < 0}
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

      <DebugBar accessibilityLabel="Turn status" accessibilityRole="text">
        {microgameScore === null ? game.turnStatus : `${game.turnStatus} · Last microgame ${microgameScore}/100`}
      </DebugBar>
      <NormalButton accessibilityLabel="Practice attack microgame" accessibilityRole="button" label="Practice Attack" onPress={() => microgame.start(game.playerClass.microgame, settings.handedness)} />

      {map}
      <Row>
        {settings.handedness === "left" ? (
          <>
            <ChargeControl
              charged={game.isCharged}
              disabled={game.isResolving || game.hasLost || (!game.isCharged && game.playerEnergy < GAME_PARAMETERS.combat.chargeEnergyCost)}
              onPress={game.toggleCharge}
            />
            {controls}
          </>
        ) : (
          <>
            {controls}
            <ChargeControl
              charged={game.isCharged}
              disabled={game.isResolving || game.hasLost || (!game.isCharged && game.playerEnergy < GAME_PARAMETERS.combat.chargeEnergyCost)}
              onPress={game.toggleCharge}
            />
          </>
        )}
      </Row>
      <Text style={{ color: colors.sepia, fontSize: 12, textAlign: "center" }}>
        Charge: stronger attack, full block + counter, or move / pick up without using a turn.
      </Text>

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

      <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "700", textAlign: "center" }}>
        Tap a monster to attack, an item to pick it up, a doorway to move, your hero to defend, or stairs to descend.
      </Text>

      <GameViewPanel
        sceneFrameStore={game.sceneFrameStore}
        canUnlockDoors={game.inventoryItem === "key" || game.playerClass.id === "thief"}
        disabled={game.isResolving || game.hasLost || microgame.active || classIntroPage >= 0}
        enemyHealthLossAmount={game.enemyHealthLossAmount}
        hardTurnCounter={game.hardTurnCounter}
        onActorPress={handleActorPress}
        onDoorwayPress={handleDoorwayPress}
        onPlayerPress={game.supportSelf}
        playerPosition={game.playerScenePosition}
        playerLabel={game.playerLabel}
        playerSprite={game.playerClass.sprite}
        roomId={game.currentRoomId}
        reducedMotion={settings.reducedMotion}
        roomDoorways={game.roomDoorways}
        roomSceneActors={game.roomSceneActors}
        playerEnergyLossAmount={game.playerEnergyLossAmount}
        playerHealthLossAmount={game.playerHealthLossAmount}
      />

      <MicrogameOverlay
        visible={microgame.active}
        kind={microgame.kind}
        elapsed={microgame.elapsed}
        targetDelay={microgame.targetDelay}
        targetSpot={microgame.targetSpot}
        clicks={microgame.clicks}
        leftHanded={settings.handedness === "left"}
        onTap={microgame.tap}
      />
      {classIntroPage >= 0 ? (
        <ClassBriefing
          page={classIntroPage}
          classId={game.playerClass.id}
          damage={game.playerAttack}
          multiplayer={false}
          onNext={() => setClassIntroPage(1)}
          onBack={() => setClassIntroPage(0)}
          onPractice={() => microgame.start(game.playerClass.microgame, settings.handedness)}
          onStart={() => setClassIntroPage(-1)}
        />
      ) : null}

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
