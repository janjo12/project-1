"use client";

import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import { Text, View } from "react-native";

import { ClassBriefing } from "@/components/Common/ClassBriefing";
import { Container, Footer, Header, Row, StyledModal, StyledText, Title } from "@/components/Common/Displays";
import { MicrogameOverlay } from "@/components/Common/MicrogameOverlay";
import { MultiplayerScreen } from "@/components/Common/MultiplayerScreen";
import { ScreenShell } from "@/components/Common/ScreenShell";
import { ThemeProvider, useThemeColors } from "@/components/Common/theme";
import { CancelButton, DestructiveButton, HelpButton, NormalButton, PrimaryButton, SegmentedButton, TextEntry, ToggleButton } from "@/components/Controls/ActionButton";
import { ChargeControl, EquipmentControl, ItemControl } from "@/components/Controls/ActionMenu";
import { DungeonMap } from "@/components/Dungeon/DungeonMap";
import { GameViewPanel } from "@/components/Dungeon/GameViewPanel";
import { DebugBar, ResourceBar, ResourceBarGroup } from "@/components/Player/PlayerHUD";
import { useMicrogame } from "@/game/actions/use-microgame";
import { GAME_PARAMETERS } from "@/game/config/gameparameters";
import { PLAYER_MAX_ENERGY, PLAYER_MAX_HEALTH, runGameLoop, useRunGame } from "@/game/engine/run-game-singleplayer";
import { useGameSettings } from "@/hooks/use-game-settings";
import { generateRandomSeed, isTestSeed } from "@/utils/seed";
import type { GameSettings } from "@/utils/settings-storage";

type Page = "title" | "setup" | "settings" | "game" | "multiplayer" | "over";
type PlayMode = "singleplayer" | "multiplayer";

export default function Home() {
  const { isLoading, settings, updateSettings, saveSettings } = useGameSettings();
  const [page, setPage] = useState<Page>("title");
  const [mode, setMode] = useState<PlayMode>("singleplayer");
  const [score, setScore] = useState(0);

  if (isLoading) {
    return <Preview><ThemeProvider appearance={settings.appearance}><ScreenShell><StyledText>Loading…</StyledText></ScreenShell></ThemeProvider></Preview>;
  }

  const goToSetup = (nextMode: PlayMode) => {
    setMode(nextMode);
    updateSettings({ seed: generateRandomSeed() });
    setPage("setup");
  };

  return (
    <Preview>
      <ThemeProvider appearance={settings.appearance}>
        {page === "title" ? (
          <ScreenShell>
            <Container>
              <Title>[Project 1]</Title>
              <StyledText>How would you like to play?</StyledText>
              <PrimaryButton accessibilityLabel="Singleplayer" accessibilityRole="button" label="Singleplayer" onPress={() => goToSetup("singleplayer")} />
              <PrimaryButton accessibilityLabel="Multiplayer · Same Wi-Fi" accessibilityRole="button" label="Multiplayer · Same Wi-Fi" onPress={() => goToSetup("multiplayer")} />
              <StyledText>Multiplayer: explore a shared dungeon, with one character on each device.</StyledText>
            </Container>
          </ScreenShell>
        ) : null}

        {page === "setup" ? (
          <SetupScreen
            settings={settings}
            onBack={() => setPage("title")}
            onSettings={() => setPage("settings")}
            onUpdate={updateSettings}
            onStart={async () => {
              const next = { ...settings, seed: settings.seed.trim() || generateRandomSeed() };
              await saveSettings(next);
              setPage(mode === "multiplayer" ? "multiplayer" : "game");
            }}
          />
        ) : null}

        {page === "settings" ? (
          <SettingsScreen settings={settings} onBack={() => setPage("setup")} onUpdate={updateSettings} />
        ) : null}

        {page === "game" && mode === "singleplayer" ? (
          <SingleplayerScreen
            settings={settings}
            onSettingsChange={updateSettings}
            onGameOver={value => { setScore(value); setPage("over"); }}
            onExit={() => setPage("title")}
          />
        ) : null}

        {page === "multiplayer" ? (
          <MultiplayerScreen settings={settings} onLeave={() => setPage("title")} />
        ) : null}

        {page === "over" ? (
          <ScreenShell>
            <Container>
              <Title>Game Over</Title>
              <Title>Score: {score}</Title>
              <PrimaryButton accessibilityLabel="Return to Title" accessibilityRole="button" label="Return to Title" onPress={() => setPage("title")} />
            </Container>
          </ScreenShell>
        ) : null}
      </ThemeProvider>
    </Preview>
  );
}

function Preview({ children }: PropsWithChildren) {
  return <div className="phone-preview">{children}</div>;
}

function SetupScreen({ settings, onBack, onSettings, onUpdate, onStart }: {
  settings: GameSettings;
  onBack: () => void;
  onSettings: () => void;
  onUpdate: (settings: Partial<GameSettings>) => void;
  onStart: () => void;
}) {
  const [helpTopic, setHelpTopic] = useState<"difficulty" | "seed" | null>(null);
  const helpContent = helpTopic === "difficulty"
    ? { title: "Difficulty", body: "Choose Easy for a casual experience. Normal requires you to beat each level in a limited number of turns. Hard keeps that turn limit and adds a timer for every turn." }
    : helpTopic === "seed" ? { title: "Seed", body: "Used for determining the random layout of each level." } : null;

  return (
    <ScreenShell>
      <Container>
        <Header>
          <NormalButton accessibilityLabel="Back" accessibilityRole="button" label="Back" onPress={onBack} />
          <NormalButton accessibilityLabel="Settings" accessibilityRole="button" icon="cog" onPress={onSettings} />
        </Header>
        <Title>[Project 1]</Title>
        <Container>
          <Row>
            <StyledText>Difficulty</StyledText>
            <SegmentedButton onChange={difficulty => onUpdate({ difficulty })} options={["easy", "normal", "hard"] as const} value={settings.difficulty} />
            <HelpButton accessibilityLabel="Difficulty help" accessibilityRole="button" onPress={() => setHelpTopic("difficulty")} />
          </Row>
          <Row>
            <StyledText>Seed</StyledText>
            <TextEntry accessibilityLabel="Seed" accessibilityRole="textbox" onChangeText={seed => onUpdate({ seed })} placeholder="Random" value={settings.seed} />
            <HelpButton accessibilityLabel="Seed help" accessibilityRole="button" onPress={() => setHelpTopic("seed")} />
          </Row>
        </Container>
        <Footer>
          <PrimaryButton accessibilityLabel="Start Game" accessibilityRole="button" label="Start" onPress={onStart} />
        </Footer>
      </Container>
      <StyledModal accessibilityLabel={helpContent ? `${helpContent.title} help` : "Help"} accessibilityRole="dialog" animationType="fade" onRequestClose={() => setHelpTopic(null)} visible={helpContent !== null}>
        {helpContent ? <><Title>{helpContent.title}</Title><StyledText>{helpContent.body}</StyledText><PrimaryButton accessibilityLabel="Close help" accessibilityRole="button" label="Got it" onPress={() => setHelpTopic(null)} /></> : null}
      </StyledModal>
    </ScreenShell>
  );
}

function SettingsScreen({ settings, onBack, onUpdate }: {
  settings: GameSettings;
  onBack: () => void;
  onUpdate: (settings: Partial<GameSettings>) => void;
}) {
  return (
    <ScreenShell>
      <Container>
        <Header><CancelButton accessibilityLabel="Back" accessibilityRole="button" label="Back" onPress={onBack} /></Header>
        <Container>
          <Title>Settings</Title>
          <ToggleButton label="Dark Mode" value={settings.appearance === "dark"} onValueChange={value => onUpdate({ appearance: value ? "dark" : "light" })} />
          <ToggleButton label="Vibration" value={settings.vibrationEnabled} onValueChange={value => onUpdate({ vibrationEnabled: value })} />
          <ToggleButton label="Left-handed controls" value={settings.handedness === "left"} onValueChange={value => onUpdate({ handedness: value ? "left" : "right" })} />
        </Container>
      </Container>
    </ScreenShell>
  );
}

function SingleplayerScreen({ settings, onSettingsChange, onGameOver, onExit }: {
  settings: GameSettings;
  onSettingsChange: (settings: Partial<GameSettings>) => void;
  onGameOver: (score: number) => void;
  onExit: () => void;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isQuitConfirmOpen, setIsQuitConfirmOpen] = useState(false);
  const [microgameScore, setMicrogameScore] = useState<number | null>(null);
  const [classIntroPage, setClassIntroPage] = useState(0);
  const colors = useThemeColors();
  const game = useRunGame({
    difficulty: settings.difficulty,
    istest: isTestSeed(settings.seed),
    onGameOver,
    seed: settings.seed.trim(),
    vibrationEnabled: settings.vibrationEnabled,
  });
  const pendingAttack = useRef<string | null>(null);
  const microgame = useMicrogame(score => {
    setMicrogameScore(score);
    const target = pendingAttack.current;
    pendingAttack.current = null;
    if (target) game.attackMonster(target, score);
  });
  useEffect(() => {
    let time = 0;
    let elapsed = 0;
    let expired = false;
    const timer = setInterval(() => {
      if (!game.isGameLoopRunning() || isMenuOpen || microgame.active || classIntroPage >= 0) return;
      const delta = GAME_PARAMETERS.turn.gameLoopTickMs;
      time += delta;
      const gameLoop = { elapsed, expired, isTurnClockActive: game.isTurnClockActive, onExpire: game.expireTurn, onFrame: game.updateGameFrame, resetKey: game.turnNumber, turnDuration: game.turnDuration };
      runGameLoop({ gameLoop }, { time: { delta, currentTime: time, previousTime: time - delta, previousDelta: delta } } as never);
      elapsed = gameLoop.elapsed;
      expired = gameLoop.expired;
    }, GAME_PARAMETERS.turn.gameLoopTickMs);
    return () => { clearInterval(timer); };
  }, [classIntroPage, game.expireTurn, game.isGameLoopRunning, game.isTurnClockActive, game.turnDuration, game.turnNumber, game.updateGameFrame, isMenuOpen, microgame.active]);

  const controls = <View style={{ flex: 1, gap: 4 }}>
    <EquipmentControl label={game.equipmentLabel} description={game.equipmentDescription} sprite={game.equipmentSprite} onDrop={game.dropEquipment} />
    <ItemControl activationDescription={game.inventoryItemActivationDescription} itemLabel={game.inventoryItemLabel} itemSprite={game.inventoryItemSprite} />
  </View>;
  const startMicrogame = () => microgame.start(game.playerClass.microgame, settings.handedness, { istest: isTestSeed(settings.seed) });

  return (
    <ScreenShell compact>
      <GameHeader onMenu={() => setIsMenuOpen(true)} />
      <DebugBar accessibilityLabel="Turn status" accessibilityRole="text">{`${game.istest ? "TEST · " : ""}${microgameScore === null ? game.turnStatus : `${game.turnStatus} · Last microgame ${microgameScore}/100`}`}</DebugBar>
      <NormalButton accessibilityLabel="Practice attack microgame" accessibilityRole="button" label="Practice Attack" onPress={startMicrogame} />
      <DungeonMap currentRoomId={game.currentRoomId} map={game.visibleDungeonMap} />
      <Row>
        {settings.handedness === "left" ? <><ChargeControl charged={game.isCharged} disabled={game.isResolving || game.hasLost || (!game.isCharged && game.playerEnergy < GAME_PARAMETERS.combat.chargeEnergyCost)} onPress={game.toggleCharge} />{controls}</> : <>{controls}<ChargeControl charged={game.isCharged} disabled={game.isResolving || game.hasLost || (!game.isCharged && game.playerEnergy < GAME_PARAMETERS.combat.chargeEnergyCost)} onPress={game.toggleCharge} /></>}
      </Row>
      <Text style={{ color: colors.sepia, fontSize: 12, textAlign: "center" }}>Charge: stronger attack, full block + counter, or move / pick up without using a turn.</Text>
      <ResourceBarGroup>
        <ResourceBar accessibilityLabel="Player health" color={colors.health} current={game.playerHealth} icon="heart" max={PLAYER_MAX_HEALTH} panelPosition="first" testID="player-health-bar" />
        <ResourceBar accessibilityLabel="Player energy" color={colors.energy} current={game.playerEnergy} icon="bolt" max={PLAYER_MAX_ENERGY} panelPosition={game.hasTurnTimer ? "middle" : "last"} testID="player-energy-bar" />
        {game.hasTurnTimer ? <ResourceBar accessibilityLabel="Turn timer" color={colors.timer} current={game.turnTimeRemaining} icon="hourglass-half" max={game.turnDuration} panelPosition="last" testID="turn-timer" /> : null}
      </ResourceBarGroup>
      <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "700", textAlign: "center" }}>Tap a monster to attack, an item to pick it up, a doorway to move, your hero to defend, or stairs to descend.</Text>
      <GameViewPanel
        sceneFrameStore={game.sceneFrameStore}
        canUnlockDoors={game.inventoryItem === "key" || game.playerClass.id === "thief"}
        disabled={game.isResolving || game.hasLost || microgame.active || classIntroPage >= 0}
        enemyHealthLossAmount={game.enemyHealthLossAmount}
        hardTurnCounter={game.hardTurnCounter}
        onActorPress={actor => {
          if (actor.kind === "enemy") { pendingAttack.current = actor.id; startMicrogame(); }
          else if (actor.kind === "item") void game.pickupItem();
          else if (actor.kind === "equipment") game.pickupEquipment();
          else if (actor.kind === "stairs") game.descend();
        }}
        onDoorwayPress={position => void game.moveToRoom(({ bottom: "south", left: "west", right: "east", top: "north" } as const)[position])}
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
      <MicrogameOverlay visible={microgame.active} kind={microgame.kind} elapsed={microgame.elapsed} targetDelay={microgame.targetDelay} targetSpot={microgame.targetSpot} clicks={microgame.clicks} leftHanded={settings.handedness === "left"} istest={microgame.istest} onTap={microgame.tap} />
      {classIntroPage >= 0 ? <ClassBriefing page={classIntroPage} classId={game.playerClass.id} damage={game.playerAttack} multiplayer={false} onNext={() => setClassIntroPage(1)} onBack={() => setClassIntroPage(0)} onPractice={startMicrogame} onStart={() => setClassIntroPage(-1)} /> : null}
      <StyledModal accessibilityLabel="Game menu" accessibilityRole="dialog" animationType="fade" onRequestClose={() => setIsMenuOpen(false)} visible={isMenuOpen}>
        <Title>Menu</Title>
        <Container>
          <ToggleButton label="Dark Mode" value={settings.appearance === "dark"} onValueChange={value => onSettingsChange({ appearance: value ? "dark" : "light" })} />
          <ToggleButton label="Vibration" value={settings.vibrationEnabled} onValueChange={value => onSettingsChange({ vibrationEnabled: value })} />
        </Container>
        <PrimaryButton accessibilityLabel="Back to Game" accessibilityRole="button" label="Back to Game" onPress={() => setIsMenuOpen(false)} />
        <DestructiveButton accessibilityLabel="Quit to Title" accessibilityRole="button" label="Quit to Title" onPress={() => setIsQuitConfirmOpen(true)} />
      </StyledModal>
      <StyledModal accessibilityLabel="Quit to Title confirmation" accessibilityRole="dialog" animationType="fade" onRequestClose={() => setIsQuitConfirmOpen(false)} visible={isQuitConfirmOpen}>
        <Title>Quit to Title?</Title>
        <StyledText>Your current run will be lost.</StyledText>
        <Row>
          <CancelButton accessibilityLabel="Cancel" accessibilityRole="button" label="Cancel" onPress={() => setIsQuitConfirmOpen(false)} />
          <DestructiveButton accessibilityLabel="Quit" accessibilityRole="button" label="Quit" onPress={() => { setIsQuitConfirmOpen(false); setIsMenuOpen(false); onExit(); }} />
        </Row>
      </StyledModal>
    </ScreenShell>
  );
}

function GameHeader({ onMenu }: { onMenu: () => void }) {
  return <Header><NormalButton accessibilityLabel="Menu" accessibilityRole="button" label="Menu" onPress={onMenu} /></Header>;
}
