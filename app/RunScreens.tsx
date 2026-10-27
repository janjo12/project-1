"use client";

import { useEffect, useRef, useState } from "react";
import { Text, View, useWindowDimensions, type ViewInstance } from "react-native";

import { Container, Footer, Header, Row, StyledModal, StyledText, Title } from "@/components/Common/Displays";
import { MicrogameOverlay } from "@/components/Common/MicrogameOverlay";
import { ScreenShell } from "@/components/Common/ScreenShell";
import { animateSpriteFlight, measureViewCenterNow } from "@/components/Common/SpriteFlight";
import { useThemeColors } from "@/components/Common/theme";
import { CancelButton, DestructiveButton, HelpButton, NormalButton, PrimaryButton, SegmentedButton, TextEntry, ToggleButton } from "@/components/Controls/ActionButton";
import { ChargeControl, EquipmentControl, ItemControl } from "@/components/Controls/ActionMenu";
import { EquipmentDetailsMenu, ItemDetailsMenu } from "@/components/Controls/InventoryDetailsMenu";
import { DungeonMap } from "@/components/Dungeon/DungeonMap";
import { GameViewPanel } from "@/components/Dungeon/GameViewPanel";
import { ResourceBar, ResourceBarGroup } from "@/components/Player/PlayerHUD";
import { TurnTimerBar } from "@/components/Player/TurnTimerBar";
import { useMicrogame } from "@/game/actions/use-microgame";
import { getEquipmentStats } from "@/game/actions/items";
import { PLAYER_MAX_ENERGY, PLAYER_MAX_HEALTH, useRunGame } from "@/game/engine/run-game-singleplayer";
import { useGameLoopDriver } from "@/game/engine/use-game-loop-driver";
import type { GameSettings } from "@/utils/settings-storage";
import { isTestSeed } from "@/utils/seed";
import { getConnectedRoomId, getRoom, getRooms } from "@/game/dungeon/rooms";
import { getRoomSceneActors } from "@/game/engine/run-game-scene";
import { getSupportFeedback } from "@/game/engine/support-feedback";
export function SetupScreen({ settings, onBack, onSettings, onUpdate, onStart, showSeed = true }: {
  settings: GameSettings;
  onBack: () => void;
  onSettings: () => void;
  onUpdate: (settings: Partial<GameSettings>) => void;
  onStart: () => void;
  showSeed?: boolean;
}) {
  const [helpTopic, setHelpTopic] = useState<"difficulty" | "seed" | null>(null);
  const compactLayout = useWindowDimensions().height < 500;
  const helpContent = helpTopic === "difficulty"
    ? { title: "Difficulty", body: "Choose Easy for a casual experience. Normal requires you to beat each level in a limited number of turns. Hard keeps that turn limit and adds a timer for every turn." }
    : helpTopic === "seed" ? { title: "Seed", body: "Used for determining the random layout of each level." } : null;

  return (
    <ScreenShell compact={compactLayout}>
      <Container style={compactLayout ? { gap: 4, paddingBottom: 0, paddingTop: 0 } : undefined}>
        <Header>
          <NormalButton accessibilityLabel="Back" accessibilityRole="button" label="Back" onPress={onBack} />
          <NormalButton accessibilityLabel="Settings" accessibilityRole="button" icon="cog" onPress={onSettings} />
        </Header>
        <Title>[Project 1]</Title>
        <Container style={compactLayout ? { gap: 4, paddingBottom: 0, paddingTop: 0 } : undefined}>
          <Row>
            <StyledText>Difficulty</StyledText>
            <SegmentedButton onChange={difficulty => onUpdate({ difficulty })} options={["easy", "normal", "hard"] as const} value={settings.difficulty} />
            <HelpButton accessibilityLabel="Difficulty help" accessibilityRole="button" onPress={() => setHelpTopic("difficulty")} />
          </Row>
          <ToggleButton label="Attack microgames" value={settings.microgamesEnabled} onValueChange={microgamesEnabled => onUpdate({ microgamesEnabled })} />
          <StyledText>Turn off for direct attacks without a timing game.</StyledText>
          <ToggleButton label="Left-handed controls" value={settings.handedness === "left"} onValueChange={value => onUpdate({ handedness: value ? "left" : "right" })} />
          {showSeed ? (
            <Row>
              <StyledText>Seed</StyledText>
              <TextEntry accessibilityLabel="Seed" accessibilityRole="textbox" onChangeText={seed => onUpdate({ seed })} placeholder="Random" value={settings.seed} />
              <HelpButton accessibilityLabel="Seed help" accessibilityRole="button" onPress={() => setHelpTopic("seed")} />
            </Row>
          ) : null}
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
        </Container>
      </Container>
    </ScreenShell>
  );
}

export function SingleplayerScreen({ settings, onSettingsChange, onGameOver, onExit, onBackToSetup }: {
  settings: GameSettings;
  onSettingsChange: (settings: Partial<GameSettings>) => void;
  onGameOver: (score: number) => void;
  onExit: () => void;
  onBackToSetup: () => void;
}) {
  const { height } = useWindowDimensions();
  const compactLayout = height < 800;
  const tinyLayout = height < 500;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLevelCleared, setIsLevelCleared] = useState(false);
  const [isQuitConfirmOpen, setIsQuitConfirmOpen] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [itemMenuOpen, setItemMenuOpen] = useState(false);
  const [equipmentMenuOpen, setEquipmentMenuOpen] = useState(false);
  const [combatMessage, setCombatMessage] = useState("");
  const [tutorial, setTutorial] = useState<{ enemyRoomId: string | null; chestRoomId: string | null; visitedRooms: string[] }>({ enemyRoomId: null, chestRoomId: null, visitedRooms: [] });
  const [supportEffect, setSupportEffect] = useState<{ targetId: string | null; emoji: string; label: string; key: number } | null>(null);
  const colors = useThemeColors();
  const pendingDefense = useRef<((score: number) => void) | null>(null);
  const startDefenseMicrogame = useRef<(resolve: (score: number) => void) => void>(() => undefined);
  const game = useRunGame({
    difficulty: settings.difficulty,
    istest: isTestSeed(settings.seed),
    onGameOver,
    onDefenseRequested: resolve => startDefenseMicrogame.current(resolve),
    seed: settings.seed.trim(),
    vibrationEnabled: settings.vibrationEnabled,
  });
  const pendingAttack = useRef<string | null>(null);
  const controlsRef = useRef<ViewInstance>(null);
  const itemTargetRef = useRef<ViewInstance>(null);
  const equipmentTargetRef = useRef<ViewInstance>(null);
  const microgame = useMicrogame(({ score, damageScore }) => {
    const resolveDefense = pendingDefense.current;
    if (resolveDefense) {
      pendingDefense.current = null;
      resolveDefense(score);
      return;
    }
    const target = pendingAttack.current;
    pendingAttack.current = null;
    if (target) game.attackMonster(target, damageScore);
  });
  const startMicrogameAction = microgame.start;
  useEffect(() => {
    startDefenseMicrogame.current = resolve => {
      pendingDefense.current = resolve;
      startMicrogameAction("defense", settings.handedness);
    };
  }, [startMicrogameAction, settings.handedness]);
  useGameLoopDriver({
    enabled: game.isGameLoopRunning() && !isMenuOpen && !isLevelCleared && !microgame.active && !itemMenuOpen && !equipmentMenuOpen,
    isTurnClockActive: game.isTurnClockActive,
    onExpire: game.expireTurn,
    onFrame: game.updateGameFrame,
    levelNumber: game.level,
    turnDuration: game.turnDuration,
    turnNumber: game.turnNumber,
  });

  const chargeCost = getEquipmentStats(game.equipment).chargeCost;
  const tutorialEnabled = game.level === 1;
  const currentRoom = getRooms(game.dungeonMap).find(room => room.id === game.currentRoomId);
  const tutorialRoomIds = new Set([game.dungeonMap.startingRoomId, ...tutorial.visitedRooms].slice(0, 4));
  const isFirstRoom = game.currentRoomId === game.dungeonMap.startingRoomId;
  const firstRoomHasEnemy = isFirstRoom && game.roomSceneActors.some(actor => actor.kind === "enemy");
  const firstRoomHasChest = isFirstRoom && !!currentRoom?.contents.some(content => (content.type === "item" || content.type === "equipment") && content.isChest);
  const shouldShowAttackHint = tutorialEnabled && (tutorial.enemyRoomId === game.currentRoomId || (tutorial.enemyRoomId === null && firstRoomHasEnemy));
  const shouldShowGetHint = tutorialEnabled && (tutorial.chestRoomId === game.currentRoomId || (tutorial.chestRoomId === null && firstRoomHasChest));
  const moveToTutorialRoom = (position: "top" | "bottom" | "left" | "right") => {
    const direction = ({ bottom: "south", left: "west", right: "east", top: "north" } as const)[position];
    const nextRoomId = getConnectedRoomId(game.dungeonMap, game.currentRoomId, direction);
    const nextRoom = nextRoomId ? getRoom(game.dungeonMap, nextRoomId) : null;
    if (tutorialEnabled && nextRoom) {
      const hasEnemy = getRoomSceneActors({ currentMonsterId: null, dungeonMap: game.dungeonMap, room: nextRoom }).some(actor => actor.kind === "enemy");
      const hasChest = nextRoom.contents.some(content => (content.type === "item" || content.type === "equipment") && content.isChest);
      setTutorial(previous => ({
        enemyRoomId: previous.enemyRoomId ?? (hasEnemy ? nextRoom.id : null),
        chestRoomId: previous.chestRoomId ?? (hasChest ? nextRoom.id : null),
        visitedRooms: previous.visitedRooms.includes(nextRoom.id) ? previous.visitedRooms : [...previous.visitedRooms, nextRoom.id],
      }));
    }
    void game.moveToRoom(direction);
  };
  const startMicrogame = () => microgame.start(game.playerClass.microgame, settings.handedness, { difficulty: settings.difficulty, level: game.level });

  return (
    <ScreenShell compact>
      {isLevelCleared ? (
        <View accessibilityLabel="Level cleared" accessibilityRole="summary" testID="level-cleared-screen" style={{ flex: 1, width: "100%", alignItems: "center", justifyContent: "center", gap: 24, padding: 24, backgroundColor: colors.paper }}>
          <Title>Level Cleared!</Title>
          <PrimaryButton
            accessibilityLabel="Continue to next level"
            accessibilityRole="button"
            label="Continue"
            onPress={() => {
              setIsLevelCleared(false);
              game.descend();
            }}
          />
        </View>
      ) : <>
      <GameHeader onMenu={() => setIsMenuOpen(true)} />
      {!tinyLayout ? <View style={{ flexShrink: 1, maxHeight: compactLayout ? 116 : undefined, minHeight: 0 }}><DungeonMap currentRoomId={game.currentRoomId} map={game.visibleDungeonMap} compact={compactLayout} showCurrentRoomHint={tutorialEnabled && tutorialRoomIds.has(game.currentRoomId)} /></View> : null}
      <View ref={controlsRef} style={{ height: 80, flexShrink: 0, flexDirection: "row", gap: 6 }}>
        {settings.handedness === "left" ? <ChargeControl charged={game.isCharged} chargeCost={chargeCost} disabled={game.isResolving || game.hasLost || (!game.isCharged && game.playerEnergy < chargeCost)} onPress={game.toggleCharge} /> : <EquipmentControl targetRef={equipmentTargetRef} label={game.equipmentLabel} sprite={game.equipmentSprite} onPress={() => setEquipmentMenuOpen(true)} />}
        <ItemControl targetRef={itemTargetRef} itemLabel={game.inventoryItemLabel} itemSprite={game.inventoryItemSprite} onPress={() => setItemMenuOpen(true)} />
        {settings.handedness === "left" ? <EquipmentControl targetRef={equipmentTargetRef} label={game.equipmentLabel} sprite={game.equipmentSprite} onPress={() => setEquipmentMenuOpen(true)} /> : <ChargeControl charged={game.isCharged} chargeCost={chargeCost} disabled={game.isResolving || game.hasLost || (!game.isCharged && game.playerEnergy < chargeCost)} onPress={game.toggleCharge} />}
      </View>
      <ResourceBarGroup compact={compactLayout} playerSprite={game.playerClass.sprite}>
        <ResourceBar compact={compactLayout} accessibilityLabel="Player health" color={colors.health} current={game.playerHealth} icon="heart" max={PLAYER_MAX_HEALTH} panelPosition="first" testID="player-health-bar" />
        <ResourceBar compact={compactLayout} accessibilityLabel="Player energy" color={colors.energy} current={game.playerEnergy} icon="bolt" max={PLAYER_MAX_ENERGY} panelPosition={game.hasTurnTimer ? "middle" : "last"} testID="player-energy-bar" />
        {game.hasTurnTimer ? <TurnTimerBar compact={compactLayout} accessibilityLabel="Turn timer" color={colors.timer} max={game.turnDuration} panelPosition="last" store={game.turnClockStore} testID="turn-timer" /> : null}
      </ResourceBarGroup>
      <View style={{ flex: 1, minHeight: 0, overflow: "hidden", position: "relative", zIndex: microgame.active ? 100 : undefined }}>
      {tinyLayout && combatMessage ? <Text pointerEvents="none" style={{ position: "absolute", top: 8, left: 0, right: 0, zIndex: 20, color: colors.accent, fontWeight: "900", textAlign: "center" }}>{combatMessage}</Text> : null}
      <GameViewPanel
        sceneFrameStore={game.sceneFrameStore}
        canUnlockDoors={game.inventoryItem === "key" || game.playerClass.id === "thief"}
        disabled={game.isResolving || game.hasLost || microgame.active || itemMenuOpen || equipmentMenuOpen}
        pauseAnimations={microgame.active}
        enemyHealthLossAmount={game.enemyHealthLossAmount}
        hardTurnCounter={game.hardTurnCounter}
        showStairsObjective
        showMoveHints={tutorialEnabled && isFirstRoom}
        showAttackHints={shouldShowAttackHint}
        showGetHint={shouldShowGetHint}
        supportEffect={supportEffect}
        onActorPress={(actor, source) => {
          if (actor.kind === "enemy") {
            const werewolfWithSilver = !!game.dungeonMap.entities.monsters[actor.id]?.chases && game.inventoryItem === "silver-bullet";
            if (werewolfWithSilver) {
              setCombatMessage("Silver Bullet worked! The Werewolf is defeated.");
              game.attackMonster(actor.id);
            } else if (settings.microgamesEnabled) {
              pendingAttack.current = actor.id;
              startMicrogame();
            } else {
              game.attackMonster(actor.id);
            }
          }
          else if (actor.kind === "item" || actor.kind === "equipment") {
            const isEquipment = actor.kind === "equipment";
            const slotFull = isEquipment ? !!game.equipment : !!game.inventoryItem;
            if (actor.isChest && slotFull) {
              game.openLootChest(actor.id, actor.kind);
              return;
            }
            if (actor.contentSprite) {
              const target = measureViewCenterNow(isEquipment ? equipmentTargetRef.current : itemTargetRef.current)
                ?? { x: (source?.x ?? 0) + 48, y: (source?.y ?? 0) + 48 };
              animateSpriteFlight({ start: source ?? { x: 0, y: 0 }, end: target, sprite: actor.contentSprite, label: actor.label });
            }
            if (isEquipment) game.pickupEquipment(actor.id);
            else void game.pickupItem(actor.id);
          }
          else if (actor.kind === "stairs") setIsLevelCleared(true);
        }}
        onDoorwayPress={moveToTutorialRoom}
        onPlayerPress={() => {
          setSupportEffect(previous => ({ targetId: null, ...getSupportFeedback(game.playerClass.id), key: (previous?.key ?? 0) + 1 }));
          game.supportSelf();
        }}
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
      <MicrogameOverlay visible={microgame.active} kind={microgame.kind} elapsedStore={microgame.elapsedStore} targetDelay={microgame.targetDelay} targetSpot={microgame.targetSpot} multitapTargetSpot={microgame.multitapTargetSpot} leftHanded={settings.handedness === "left"} onTap={microgame.tap} />
      </View>
      <ItemDetailsMenu visible={itemMenuOpen && !!game.inventoryItemLabel} label={game.inventoryItemLabel ?? "Item"} description={game.inventoryItemDescription ?? "A useful item."} activationDescription={game.inventoryItemActivationDescription ?? "This item activates automatically when its condition is met."} onClose={() => setItemMenuOpen(false)} />
      <EquipmentDetailsMenu visible={equipmentMenuOpen && !!game.equipmentLabel} label={game.equipmentLabel ?? "Equipment"} description={game.equipmentDescription ?? "Equipment provides its listed effects while carried."} dropDisabled={game.isResolving || game.hasLost || microgame.active} onDrop={() => { game.dropEquipment(); setEquipmentMenuOpen(false); }} onClose={() => setEquipmentMenuOpen(false)} />
      <StyledModal accessibilityLabel="Game menu" accessibilityRole="dialog" animationType="fade" onRequestClose={() => setIsMenuOpen(false)} visible={isMenuOpen}>
        <Title>Menu</Title>
        <StyledText>Seed: {settings.seed.trim()}</StyledText>
        <Container style={tinyLayout ? { gap: 6 } : undefined}>
          <Row>
            <StyledText>Appearance</StyledText>
            <SegmentedButton
              onChange={appearance => onSettingsChange({ appearance: appearance.toLowerCase() as GameSettings["appearance"] })}
              options={["System", "Light", "Dark"] as const}
              value={settings.appearance[0].toUpperCase() + settings.appearance.slice(1)}
            />
          </Row>
          <ToggleButton label="Vibration" value={settings.vibrationEnabled} onValueChange={value => onSettingsChange({ vibrationEnabled: value })} />
          <ToggleButton label="Left-handed controls" value={settings.handedness === "left"} onValueChange={value => onSettingsChange({ handedness: value ? "left" : "right" })} />
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
        <DungeonMap currentRoomId={game.currentRoomId} map={game.visibleDungeonMap} showCurrentRoomHint={tutorialEnabled && tutorialRoomIds.has(game.currentRoomId)} />
        <PrimaryButton accessibilityLabel="Close map" accessibilityRole="button" label="Close map" onPress={() => setIsMapOpen(false)} />
      </StyledModal>
      </>}
    </ScreenShell>
  );
}

function GameHeader({ onMenu }: { onMenu: () => void }) {
  return <Header><NormalButton accessibilityLabel="Menu" accessibilityRole="button" label="Menu" onPress={onMenu} /></Header>;
}
