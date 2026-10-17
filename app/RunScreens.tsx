"use client";

import { useRef, useState } from "react";
import { Text, View, useWindowDimensions } from "react-native";

import { ClassBriefing } from "@/components/Common/ClassBriefing";
import { Container, Footer, Header, Row, StyledModal, StyledText, Title } from "@/components/Common/Displays";
import { MicrogameOverlay } from "@/components/Common/MicrogameOverlay";
import { ScreenShell } from "@/components/Common/ScreenShell";
import { useThemeColors } from "@/components/Common/theme";
import { CancelButton, DestructiveButton, HelpButton, NormalButton, PrimaryButton, SegmentedButton, TextEntry, ToggleButton } from "@/components/Controls/ActionButton";
import { ChargeControl, EquipmentControl, ItemControl } from "@/components/Controls/ActionMenu";
import { DungeonMap } from "@/components/Dungeon/DungeonMap";
import { GameViewPanel } from "@/components/Dungeon/GameViewPanel";
import { DebugBar, ResourceBar, ResourceBarGroup } from "@/components/Player/PlayerHUD";
import { TurnTimerBar } from "@/components/Player/TurnTimerBar";
import { useMicrogame } from "@/game/actions/use-microgame";
import { getEquipmentStats } from "@/game/actions/items";
import { PLAYER_MAX_ENERGY, PLAYER_MAX_HEALTH, useRunGame } from "@/game/engine/run-game-singleplayer";
import { useGameLoopDriver } from "@/game/engine/use-game-loop-driver";
import { isTestSeed } from "@/utils/seed";
import type { GameSettings } from "@/utils/settings-storage";
export function SetupScreen({ settings, onBack, onSettings, onUpdate, onStart }: {
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
          <ToggleButton label="Attack microgames" value={settings.microgamesEnabled} onValueChange={microgamesEnabled => onUpdate({ microgamesEnabled })} />
          <StyledText>Turn off for direct attacks without a timing game.</StyledText>
          <Row>
            <StyledText>Seed</StyledText>
            <TextEntry accessibilityLabel="Seed" accessibilityRole="textbox" onChangeText={seed => onUpdate({ seed })} placeholder="Random" value={settings.seed} />
            <HelpButton accessibilityLabel="Seed help" accessibilityRole="button" onPress={() => setHelpTopic("seed")} />
          </Row>
        </Container>
        <Footer>
          <PrimaryButton accessibilityLabel="Start" accessibilityRole="button" label="Start" onPress={onStart} />
        </Footer>
      </Container>
      <StyledModal accessibilityLabel={helpContent ? `${helpContent.title} help` : "Help"} accessibilityRole="dialog" animationType="fade" onRequestClose={() => setHelpTopic(null)} visible={helpContent !== null}>
        {helpContent ? <><Title>{helpContent.title}</Title><StyledText>{helpContent.body}</StyledText><PrimaryButton accessibilityLabel="Got it" accessibilityRole="button" label="Got it" onPress={() => setHelpTopic(null)} /></> : null}
      </StyledModal>
    </ScreenShell>
  );
}

export function SettingsScreen({ settings, onBack, onUpdate }: {
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
          <Row>
            <StyledText>Appearance</StyledText>
            <SegmentedButton
              onChange={appearance => onUpdate({ appearance: appearance.toLowerCase() as GameSettings["appearance"] })}
              options={["System", "Light", "Dark"] as const}
              value={settings.appearance[0].toUpperCase() + settings.appearance.slice(1)}
            />
          </Row>
          <ToggleButton label="Vibration" value={settings.vibrationEnabled} onValueChange={value => onUpdate({ vibrationEnabled: value })} />
          <ToggleButton label="Left-handed controls" value={settings.handedness === "left"} onValueChange={value => onUpdate({ handedness: value ? "left" : "right" })} />
          <ToggleButton label="Reduce motion" value={settings.reducedMotion} onValueChange={value => onUpdate({ reducedMotion: value })} />
          <StyledText>Skips room slides, doorway pulsing, and idle enemy bobbing.</StyledText>
        </Container>
      </Container>
    </ScreenShell>
  );
}

export function SingleplayerScreen({ settings, onSettingsChange, onGameOver, onExit }: {
  settings: GameSettings;
  onSettingsChange: (settings: Partial<GameSettings>) => void;
  onGameOver: (score: number) => void;
  onExit: () => void;
}) {
  const { height } = useWindowDimensions();
  const compactLayout = height < 800;
  const tinyLayout = height < 500;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isQuitConfirmOpen, setIsQuitConfirmOpen] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
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
  useGameLoopDriver({
    enabled: game.isGameLoopRunning() && !isMenuOpen && !microgame.active && classIntroPage < 0,
    isTurnClockActive: game.isTurnClockActive,
    onExpire: game.expireTurn,
    onFrame: game.updateGameFrame,
    levelNumber: game.level,
    turnDuration: game.turnDuration,
    turnNumber: game.turnNumber,
  });

  const controls = <View style={{ flex: 1, gap: 4 }}>
    <EquipmentControl label={game.equipmentLabel} description={game.equipmentDescription} sprite={game.equipmentSprite} onDrop={game.dropEquipment} />
    <ItemControl activationDescription={game.inventoryItemActivationDescription} itemLabel={game.inventoryItemLabel} itemSprite={game.inventoryItemSprite} onDrop={game.dropItem} />
  </View>;
  const chargeCost = getEquipmentStats(game.equipment).chargeCost;
  const startMicrogame = () => microgame.start(game.playerClass.microgame, settings.handedness, { istest: isTestSeed(settings.seed) });

  return (
    <ScreenShell compact>
      <GameHeader onMenu={() => setIsMenuOpen(true)} />
      {!tinyLayout ? <DebugBar accessibilityLabel="Turn status" accessibilityRole="text" testID="turn-status">{`${game.istest ? "TEST · " : ""}${microgameScore === null ? game.turnStatus : `${game.turnStatus} · Last microgame ${microgameScore}/100`}`}</DebugBar> : null}
      {!tinyLayout ? <View style={{ flexShrink: 1, maxHeight: compactLayout ? 116 : undefined, minHeight: 0 }}><DungeonMap currentRoomId={game.currentRoomId} map={game.visibleDungeonMap} compact={compactLayout} /></View> : null}
      <Row>
        {settings.handedness === "left" ? <><ChargeControl charged={game.isCharged} chargeCost={chargeCost} disabled={game.isResolving || game.hasLost || (!game.isCharged && game.playerEnergy < chargeCost)} onPress={game.toggleCharge} />{controls}</> : <>{controls}<ChargeControl charged={game.isCharged} chargeCost={chargeCost} disabled={game.isResolving || game.hasLost || (!game.isCharged && game.playerEnergy < chargeCost)} onPress={game.toggleCharge} /></>}
      </Row>
      {!compactLayout ? <Text style={{ color: colors.sepia, fontSize: 12, textAlign: "center" }}>Charge: stronger attack, full block + counter, or move / pick up without using a turn.</Text> : null}
      <ResourceBarGroup compact={compactLayout}>
        <ResourceBar compact={compactLayout} accessibilityLabel="Player health" color={colors.health} current={game.playerHealth} icon="heart" max={PLAYER_MAX_HEALTH} panelPosition="first" testID="player-health-bar" />
        <ResourceBar compact={compactLayout} accessibilityLabel="Player energy" color={colors.energy} current={game.playerEnergy} icon="bolt" max={PLAYER_MAX_ENERGY} panelPosition={game.hasTurnTimer ? "middle" : "last"} testID="player-energy-bar" />
        {game.hasTurnTimer ? <TurnTimerBar compact={compactLayout} accessibilityLabel="Turn timer" color={colors.timer} max={game.turnDuration} panelPosition="last" store={game.turnClockStore} testID="turn-timer" /> : null}
      </ResourceBarGroup>
      {!compactLayout ? <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "700", textAlign: "center" }}>Tap a monster to attack, an item to pick it up, a doorway to move, your hero to use their class support skill, or stairs to descend.</Text> : null}
      <GameViewPanel
        sceneFrameStore={game.sceneFrameStore}
        canUnlockDoors={game.inventoryItem === "key" || game.playerClass.id === "thief"}
        disabled={game.isResolving || game.hasLost || microgame.active || classIntroPage >= 0}
        enemyHealthLossAmount={game.enemyHealthLossAmount}
        hardTurnCounter={game.hardTurnCounter}
        onActorPress={actor => {
          if (actor.kind === "enemy") {
            if (settings.microgamesEnabled) {
              pendingAttack.current = actor.id;
              startMicrogame();
            } else {
              game.attackMonster(actor.id);
            }
          }
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
      <MicrogameOverlay visible={microgame.active} kind={microgame.kind} elapsedStore={microgame.elapsedStore} targetDelay={microgame.targetDelay} targetSpot={microgame.targetSpot} clicks={microgame.clicks} leftHanded={settings.handedness === "left"} isTest={microgame.istest} playerSprite={game.playerClass.sprite} onTap={microgame.tap} />
      {classIntroPage >= 0 ? <ClassBriefing page={classIntroPage} classId={game.playerClass.id} damage={microgameScore === null ? game.playerAttack : Math.max(1, Math.floor(game.playerAttack * microgameScore / 100))} multiplayer={false} microgamesEnabled={settings.microgamesEnabled} onNext={() => setClassIntroPage(1)} onBack={() => setClassIntroPage(0)} onPractice={startMicrogame} onStart={() => setClassIntroPage(-1)} /> : null}
      <StyledModal accessibilityLabel="Game menu" accessibilityRole="dialog" animationType="fade" onRequestClose={() => setIsMenuOpen(false)} visible={isMenuOpen}>
        <Title>Menu</Title>
        <Container>
          <Row>
            <StyledText>Appearance</StyledText>
            <SegmentedButton
              onChange={appearance => onSettingsChange({ appearance: appearance.toLowerCase() as GameSettings["appearance"] })}
              options={["System", "Light", "Dark"] as const}
              value={settings.appearance[0].toUpperCase() + settings.appearance.slice(1)}
            />
          </Row>
          <ToggleButton label="Vibration" value={settings.vibrationEnabled} onValueChange={value => onSettingsChange({ vibrationEnabled: value })} />
          <ToggleButton label="Reduce motion" value={settings.reducedMotion} onValueChange={value => onSettingsChange({ reducedMotion: value })} />
        </Container>
        {tinyLayout ? <NormalButton accessibilityLabel="Open dungeon map" accessibilityRole="button" label="Dungeon Map" onPress={() => { setIsMenuOpen(false); setIsMapOpen(true); }} /> : null}
        {settings.microgamesEnabled ? <NormalButton accessibilityLabel="Practice attack microgame" accessibilityRole="button" label="Practice Attack" onPress={() => { setIsMenuOpen(false); startMicrogame(); }} /> : null}
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
      <StyledModal accessibilityLabel="Dungeon map" accessibilityRole="dialog" animationType="fade" onRequestClose={() => setIsMapOpen(false)} visible={isMapOpen}>
        <Title>Dungeon Map</Title>
        <DungeonMap currentRoomId={game.currentRoomId} map={game.visibleDungeonMap} />
        <PrimaryButton accessibilityLabel="Close map" accessibilityRole="button" label="Close map" onPress={() => setIsMapOpen(false)} />
      </StyledModal>
    </ScreenShell>
  );
}

function GameHeader({ onMenu }: { onMenu: () => void }) {
  return <Header><NormalButton accessibilityLabel="Menu" accessibilityRole="button" label="Menu" onPress={onMenu} /></Header>;
}
