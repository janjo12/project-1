import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Text, View, useWindowDimensions, type ViewInstance } from "react-native";

import { Header, StyledModal, Title } from "@/components/Common/Displays";
import { PauseMenu } from "@/components/Common/PauseMenu";
import { DungeonMap } from "@/components/Dungeon/DungeonMap";
import { ChargeControl, EquipmentControl, ItemControl } from "@/components/Controls/ActionMenu";
import { EquipmentDetailsMenu, ItemDetailsMenu } from "@/components/Controls/InventoryDetailsMenu";
import { GameViewPanel, type RoomSceneActor, type ScenePosition, type ScreenPoint } from "@/components/Dungeon/GameViewPanel";
import { ClassBriefing } from "@/components/Common/ClassBriefing";
import { NormalButton, PrimaryButton } from "@/components/Controls/ActionButton";
import { ResourceBar, ResourceBarGroup } from "@/components/Player/PlayerHUD";
import { TurnTimerBar } from "@/components/Player/TurnTimerBar";
import { ScreenShell } from "@/components/Common/ScreenShell";
import { animateSpriteFlight, measureViewCenterNow } from "@/components/Common/SpriteFlight";
import { ThemeProvider, useThemeColors } from "@/components/Common/theme";

import { getEquipmentStats } from "@/game/actions/items";
import {
    PLAYER_MAX_ENERGY,
    PLAYER_MAX_HEALTH,
    useRunGame,
} from "@/game/engine/run-game-singleplayer";
import { useGameLoopDriver } from "@/game/engine/use-game-loop-driver";
import { isRunGameLoopEnabled } from "@/game/engine/game-loop-policy";
import { requestPickupSpriteFlight } from "@/game/actions/pickup-flight";
import { useGameSettings } from "@/hooks/use-game-settings";
import { MicrogameOverlay } from "@/components/Common/MicrogameOverlay";
import { useMicrogame } from "@/game/actions/use-microgame";
import { scaleMicrogameScore } from "@/game/engine/combat";
import type { GameSettings } from "@/utils/settings-storage";
import { isTestSeed } from "@/utils/seed";
type GameContentProps = {
  onSettingsChange: (settings: Partial<GameSettings>) => void;
  settings: GameSettings;
};

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
  const { height } = useWindowDimensions();
  const compactLayout = height < 800;
  const tinyLayout = height < 500;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLevelCleared, setIsLevelCleared] = useState(false);
  const [itemMenuOpen, setItemMenuOpen] = useState(false);
  const [equipmentMenuOpen, setEquipmentMenuOpen] = useState(false);
  const colors = useThemeColors();
  const pendingDefense = useRef<((score: number) => void) | null>(null);
  const startDefenseMicrogame = useRef<(resolve: (score: number) => void) => void>(() => undefined);
  const game = useRunGame({
    difficulty: settings.difficulty,
    istest: isTestSeed(settings.seed),
    onGameOver: (score) =>
      router.replace({
        pathname: "/game-over",
        params: { score: String(score) },
      }),
    onDefenseRequested: resolve => startDefenseMicrogame.current(resolve),
    seed: settings.seed.trim(),
    vibrationEnabled: settings.vibrationEnabled,
  });
  const [microgameScore, setMicrogameScore] = useState<number | null>(null);
  const [microgameScoreTotal, setMicrogameScoreTotal] = useState(0);
  const [microgameCount, setMicrogameCount] = useState(0);
  const [combatMessage, setCombatMessage] = useState("");
  const [classIntroPage, setClassIntroPage] = useState(0);
  const [isMapOpen, setIsMapOpen] = useState(false);
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
    setMicrogameScore(damageScore);
    setMicrogameScoreTotal(total => total + score);
    setMicrogameCount(count => count + 1);
    const target = pendingAttack.current;
    pendingAttack.current = null;
    if (target) game.attackMonster(target, damageScore);
  });
  const startMicrogameAction = microgame.start;
  useEffect(() => {
    startDefenseMicrogame.current = resolve => {
      pendingDefense.current = resolve;
      startMicrogameAction("defense", settings.handedness, { difficulty: settings.difficulty, level: game.level, easeLevel: game.microgameEaseLevel });
    };
  }, [game.level, game.microgameEaseLevel, settings.difficulty, settings.handedness, startMicrogameAction]);
  useGameLoopDriver({
    enabled: isRunGameLoopEnabled({
      running: game.isGameLoopRunning(), pauseMenuOpen: isMenuOpen || isLevelCleared, itemMenuOpen,
      equipmentMenuOpen, mapOpen: isMapOpen, microgameActive: microgame.active,
      classIntroOpen: classIntroPage >= 0,
    }),
    isTurnClockActive: game.isTurnClockActive,
    onExpire: game.expireTurn,
    onFrame: game.updateGameFrame,
    levelNumber: game.level,
    turnDuration: game.turnDuration,
    turnNumber: game.turnNumber,
  });
  const map = (
    <View style={{ flexShrink: 1, maxHeight: compactLayout ? 116 : undefined, minHeight: 0 }}>
      <DungeonMap currentRoomId={game.currentRoomId} map={game.visibleDungeonMap} compact={compactLayout} />
    </View>
  );
  const chargeCost = getEquipmentStats(game.equipment).chargeCost;

  async function handleActorPress(actor: RoomSceneActor, source?: ScreenPoint) {
    if (actor.kind === "enemy") {
      const werewolfWithSilver = !!game.dungeonMap.entities.monsters[actor.id]?.chases && game.inventoryItem === "silver-bullet";
      if (werewolfWithSilver) {
        setCombatMessage("Silver Arrow worked! The Werewolf is defeated.");
        game.attackMonster(actor.id);
      } else if (settings.microgamesEnabled) {
        pendingAttack.current = actor.id;
        microgame.start(game.playerClass.microgame, settings.handedness, { difficulty: settings.difficulty, level: game.level, easeLevel: game.microgameEaseLevel });
      } else {
        game.attackMonster(actor.id);
      }
    } else if (actor.kind === "item") {
      const start = source ?? measureViewCenterNow(controlsRef.current) ?? { x: 0, y: 0 };
      const end = measureViewCenterNow(itemTargetRef.current) ?? measureViewCenterNow(controlsRef.current) ?? { x: start.x + 48, y: start.y + 48 };
      requestPickupSpriteFlight(actor, start, end, animateSpriteFlight);
      void game.pickupItem();
    } else if (actor.kind === "equipment") {
      const start = source ?? measureViewCenterNow(controlsRef.current) ?? { x: 0, y: 0 };
      const end = measureViewCenterNow(equipmentTargetRef.current) ?? measureViewCenterNow(controlsRef.current) ?? { x: start.x + 48, y: start.y + 48 };
      requestPickupSpriteFlight(actor, start, end, animateSpriteFlight);
      game.pickupEquipment();
    } else {
      setIsLevelCleared(true);
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
      <Header>
        <NormalButton
          accessibilityLabel="Menu"
          accessibilityRole="button"
          label="Menu"
          onPress={() => setIsMenuOpen(true)}
        />
      </Header>

      {!tinyLayout ? map : null}
      <View ref={controlsRef} style={{ height: 80, flexShrink: 0, flexDirection: "row", gap: 6 }}>
        {settings.handedness === "left" ? (
          <>
            <ChargeControl
              charged={game.isCharged}
              chargeCost={chargeCost}
              disabled={game.isResolving || game.hasLost || (!game.isCharged && game.playerEnergy < chargeCost)}
              onPress={game.toggleCharge}
            />
            <ItemControl itemLabel={game.inventoryItemLabel} itemSprite={game.inventoryItemSprite} targetRef={itemTargetRef} onPress={() => setItemMenuOpen(true)} />
            <EquipmentControl label={game.equipmentLabel} sprite={game.equipmentSprite} targetRef={equipmentTargetRef} onPress={() => setEquipmentMenuOpen(true)} />
          </>
        ) : (
          <>
            <EquipmentControl label={game.equipmentLabel} sprite={game.equipmentSprite} targetRef={equipmentTargetRef} onPress={() => setEquipmentMenuOpen(true)} />
            <ItemControl itemLabel={game.inventoryItemLabel} itemSprite={game.inventoryItemSprite} targetRef={itemTargetRef} onPress={() => setItemMenuOpen(true)} />
            <ChargeControl
              charged={game.isCharged}
              chargeCost={chargeCost}
              disabled={game.isResolving || game.hasLost || (!game.isCharged && game.playerEnergy < chargeCost)}
              onPress={game.toggleCharge}
            />
          </>
        )}
      </View>

      <ResourceBarGroup compact={compactLayout} playerSprite={game.playerClass.sprite}>
        <ResourceBar
          accessibilityLabel="Player health"
          color={colors.health}
          current={game.playerHealth}
          icon="heart"
          max={PLAYER_MAX_HEALTH}
          panelPosition="first"
          testID="player-health-bar"
          compact={compactLayout}
        />
        <ResourceBar
          accessibilityLabel="Player energy"
          color={colors.energy}
          current={game.playerEnergy}
          icon="bolt"
          max={PLAYER_MAX_ENERGY}
          panelPosition={game.hasTurnTimer ? "middle" : "last"}
          testID="player-energy-bar"
          compact={compactLayout}
        />
        {game.hasTurnTimer ? (
          <TurnTimerBar
            accessibilityLabel="Turn timer"
            color={colors.timer}
            max={game.turnDuration}
            panelPosition="last"
            store={game.turnClockStore}
            testID="turn-timer"
            compact={compactLayout}
          />
        ) : null}
      </ResourceBarGroup>


      <View style={{ flex: 1, minHeight: 0, overflow: "hidden", position: "relative", zIndex: microgame.active ? 100 : undefined }}>
      {tinyLayout && combatMessage ? <Text pointerEvents="none" style={{ position: "absolute", top: 8, left: 0, right: 0, zIndex: 20, color: colors.accent, fontWeight: "900", textAlign: "center" }}>{combatMessage}</Text> : null}
      <GameViewPanel
        sceneFrameStore={game.sceneFrameStore}
        canUnlockDoors={game.inventoryItem === "key" || game.playerClass.id === "thief"}
        disabled={game.isResolving || game.hasLost || microgame.active || classIntroPage >= 0}
        pauseAnimations={microgame.active}
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
        elapsedStore={microgame.elapsedStore}
        targetDelay={microgame.targetDelay}
        targetSpot={microgame.targetSpot}
        multitapTargetSpot={microgame.multitapTargetSpot}
        multiswipeTarget={microgame.multiswipeTarget}
        leftHanded={settings.handedness === "left"}
        onTap={microgame.tap}
        onSwipeStart={microgame.startSwipe}
        onSwipeEnd={microgame.endSwipe}
        onMultiswipeLayout={microgame.updateMultiswipeTarget}
        onRuneProgress={microgame.updateRuneProgress}
        onRuneComplete={progress => microgame.finishRuneTracer(true, progress)}
      />
      </View>
      {classIntroPage >= 0 && !(classIntroPage === 1 && !settings.microgamesEnabled) ? (
        <ClassBriefing
          page={classIntroPage}
          classId={game.playerClass.id}
          damage={microgameScore === null ? game.playerAttack : Math.max(1, Math.floor(game.playerAttack * scaleMicrogameScore(microgameScore, settings.difficulty) / 100))}
          multiplayer={false}
          microgamesEnabled={settings.microgamesEnabled}
          onExit={() => router.replace({ pathname: "/setup", params: { mode: "singleplayer" } })}
          onNext={() => setClassIntroPage(settings.microgamesEnabled ? 1 : -1)}
          onBack={() => setClassIntroPage(0)}
          onPractice={() => microgame.start(game.playerClass.microgame, settings.handedness, { difficulty: settings.difficulty, level: game.level, easeLevel: game.microgameEaseLevel })}
          onStart={() => setClassIntroPage(-1)}
        />
      ) : null}

      <PauseMenu
        onBackToGame={() => setIsMenuOpen(false)}
        onQuitToTitle={confirmQuitToTitle}
        onPractice={() => { setIsMenuOpen(false); microgame.start(game.playerClass.microgame, settings.handedness, { difficulty: settings.difficulty, level: game.level, easeLevel: game.microgameEaseLevel }); }}
        onPracticeRuneTracer={() => { setIsMenuOpen(false); microgame.start("rune-tracer", settings.handedness, { difficulty: settings.difficulty, level: game.level }); }}
        level={game.level}
        classId={game.playerClass.id}
        microgameAverage={microgameCount ? microgameScoreTotal / microgameCount : null}
        microgamesEnabled={settings.microgamesEnabled}
        onOpenMap={tinyLayout ? () => { setIsMenuOpen(false); setIsMapOpen(true); } : undefined}
        onSettingsChange={onSettingsChange}
        settings={settings}
        seed={settings.seed.trim()}
        visible={isMenuOpen}
      />
      <ItemDetailsMenu visible={itemMenuOpen} label={game.inventoryItemLabel ?? "Item"}
        description={game.inventoryItemDescription ?? "A useful item."}
        activationDescription={game.inventoryItemActivationDescription ?? "This item activates automatically when its condition is met."}
        showUseNow={game.showUseItemNow}
        useNowDisabled={!game.canUseItemNow || game.isResolving || game.hasLost}
        onUseNow={() => { if (game.useItemNow()) setItemMenuOpen(false); }}
        onClose={() => setItemMenuOpen(false)} />
      <EquipmentDetailsMenu visible={equipmentMenuOpen} label={game.equipmentLabel ?? "Equipment"}
        description={game.equipmentDescription ?? "Equipment provides its listed effects while carried."}
        onDrop={() => { game.dropEquipment(); setEquipmentMenuOpen(false); }} onClose={() => setEquipmentMenuOpen(false)} />
      <StyledModal accessibilityLabel="Dungeon map" accessibilityRole="dialog" animationType="fade" onRequestClose={() => setIsMapOpen(false)} visible={isMapOpen}>
        <Title>Dungeon Map</Title>
        <DungeonMap currentRoomId={game.currentRoomId} map={game.visibleDungeonMap} />
        <PrimaryButton accessibilityLabel="Close map" accessibilityRole="button" label="Close map" onPress={() => setIsMapOpen(false)} />
      </StyledModal>
      <StyledModal accessibilityLabel="Level cleared" accessibilityRole="dialog" animationType="fade" onRequestClose={() => setIsLevelCleared(false)} visible={isLevelCleared}>
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
      </StyledModal>
    </ScreenShell>
  );
}
