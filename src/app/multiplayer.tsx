import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Text, TextInput, View, useWindowDimensions, type ViewInstance } from "react-native";

import { ClassBriefing } from "@/components/Common/ClassBriefing";
import { Row, StyledText, Title } from "@/components/Common/Displays";
import { MicrogameOverlay } from "@/components/Common/MicrogameOverlay";
import { ScreenShell } from "@/components/Common/ScreenShell";
import { ThemeProvider, useThemeColors } from "@/components/Common/theme";
import { NormalButton, PrimaryButton } from "@/components/Controls/ActionButton";
import { ChargeControl, EquipmentControl, ItemControl } from "@/components/Controls/ActionMenu";
import { EquipmentDetailsMenu, ItemDetailsMenu } from "@/components/Controls/InventoryDetailsMenu";
import { DungeonMap } from "@/components/Dungeon/DungeonMap";
import { GameViewPanel } from "@/components/Dungeon/GameViewPanel";
import { ResourceBar, ResourceBarGroup } from "@/components/Player/PlayerHUD";
import { getEquipmentStats } from "@/game/actions/items";
import { useMicrogame } from "@/game/actions/use-microgame";
import { getGameClass } from "@/game/config/game-classes";
import { getConnectedRoomId, getRoom, getRoomMonster, unlockDoor } from "@/game/dungeon/rooms";
import { getPlayerAttackDamage, resolveAttackDamage } from "@/game/engine/combat";
import { useRunMultiplayerGame } from "@/game/engine/run-game-multiplayer";
import type { PlayerAction } from "@/game/engine/multiplayer-rules";
import { getMultiplayerPlayerAuraColor, getMultiplayerRoomActors } from "@/game/engine/multiplayer-presentation";
import { PLAYER_MAX_ENERGY, PLAYER_MAX_HEALTH } from "@/game/state/types";
import { useGameSettings } from "@/hooks/use-game-settings";
import type { GameSettings } from "@/utils/settings-storage";
import { isTestSeed } from "@/utils/seed";

export default function MultiplayerRoute() {
  const { host } = useLocalSearchParams<{ host?: string }>();
  const { settings, isLoading } = useGameSettings();
  if (isLoading) return null;

  return (
    <ThemeProvider appearance={settings.appearance}>
      <Multiplayer settings={settings} startAsHost={host === "true"} />
    </ThemeProvider>
  );
}

function Multiplayer({ settings, startAsHost }: { settings: GameSettings; startAsHost: boolean }) {
  const { height } = useWindowDimensions();
  const compactLayout = height < 800;
  const tinyLayout = height < 500;
  const colors = useThemeColors();
  const {
    role,
    playerId,
    state,
    outgoing,
    incoming,
    setIncoming,
    pendingId,
    ready,
    lobbyPlayers,
    error,
    busy,
    connected,
    submitted,
    charged,
    seconds,
    disconnected,
    player,
    map,
    snapshot,
    hostGame,
    start,
    submit,
    removePlayer,
    chooseGuest,
    addGuest,
    join,
    accept,
    cancelInvitation,
    toggleCharge,
  } = useRunMultiplayerGame(settings);

  const [introPage, setIntroPage] = useState(0);
  const [storedScore, setStoredScore] = useState<number | null>(null);
  const [combatMessage, setCombatMessage] = useState("");
  const [itemDetailsOpen, setItemDetailsOpen] = useState(false);
  const [equipmentDetailsOpen, setEquipmentDetailsOpen] = useState(false);
  const itemTargetRef = useRef<ViewInstance>(null);
  const equipmentTargetRef = useRef<ViewInstance>(null);
  const pendingAttack = useRef<string | null>(null);
  const pendingDefenseAction = useRef<PlayerAction | null>(null);
  const microgameMode = useRef<"attack" | "defense" | "practice">("practice");
  const hostStartedRef = useRef(false);
  useEffect(() => {
    if (startAsHost && !hostStartedRef.current) {
      hostStartedRef.current = true;
      hostGame();
    }
  }, [hostGame, startAsHost]);
  const microgame = useMicrogame(({ score, damageScore }) => {
    setStoredScore(score);
    if (microgameMode.current === "defense") {
      const action = pendingDefenseAction.current;
      pendingDefenseAction.current = null;
      microgameMode.current = "practice";
      if (action) submit({ ...action, defenseScore: score });
      return;
    }
    const target = pendingAttack.current;
    pendingAttack.current = null;
    microgameMode.current = "practice";
    if (target) submitAfterDefense({ type: "ATTACK", target, microgameScore: damageScore });
  });

  function shouldRunDefense(action: PlayerAction) {
    if (!state || !player || player.health <= 0 || action.type === "CLASS_READY" || action.type === "DROP_EQUIPMENT") return false;
    let destinationRoomId = player.roomId;
    if (action.type === "MOVE" && ["north", "east", "south", "west"].includes(action.target ?? "")) {
      const direction = action.target as "north" | "east" | "south" | "west";
      const sourceRoom = getRoom(state.map, player.roomId);
      const keyUnlock = sourceRoom[direction] === "locked" && player.item === "key";
      const chargedThiefUnlock = sourceRoom[direction] === "locked" && player.classId === "thief" && charged;
      const destinationMap = keyUnlock || chargedThiefUnlock ? unlockDoor(state.map, player.roomId, direction) : state.map;
      destinationRoomId = getConnectedRoomId(destinationMap, player.roomId, direction) ?? player.roomId;
    }
    const targetRoom = getRoom(state.map, destinationRoomId);
    const enemy = getRoomMonster(state.map, targetRoom);
    if (!enemy) return false;
    if (action.type === "ATTACK") {
      const target = getRoom(state.map, player.roomId).contents
        .map(content => content.type === "monster" ? state.map.entities.monsters[content.id] : null)
        .find(monster => monster !== null && monster.id === action.target && (monster.currentHealth ?? 0) > 0);
      if (target) {
        const damage = target.chases && player.item === "silver-bullet"
          ? target.currentHealth
          : resolveAttackDamage({
            profile: getPlayerAttackDamage(target, action.charged ?? charged),
            score: action.microgameScore ?? 100,
            equipmentAttack: getEquipmentStats(player.equipment).attack,
            charged: action.charged ?? charged,
            target,
          });
        if (damage >= target.currentHealth) return false;
      }
    }
    return true;
  }

  function submitAfterDefense(action: PlayerAction) {
    if (!shouldRunDefense(action)) {
      microgameMode.current = "practice";
      submit(action);
      return;
    }
    pendingDefenseAction.current = action;
    microgameMode.current = "defense";
    microgame.start("defense", settings.handedness, { difficulty: state!.difficulty, level: state!.level });
  }

  return (
    <ScreenShell compact={!!state}>
      {disconnected ? (
        <>
          <StyledText>{error || "Disconnected from the host. Leave and join a new lobby."}</StyledText>
          <PrimaryButton
            accessibilityLabel="Play singleplayer instead"
            accessibilityRole="button"
            label="Play singleplayer instead"
            onPress={() => router.replace({ pathname: "/setup", params: { mode: "singleplayer" } })}
          />
          <NormalButton
            accessibilityLabel="Leave multiplayer"
            accessibilityRole="button"
            label="Leave multiplayer"
            onPress={() => router.replace("/")}
          />
        </>
      ) : (
      <>
      <NormalButton
        accessibilityLabel="Leave multiplayer"
        accessibilityRole="button"
        label="Leave multiplayer"
        onPress={() => router.replace("/")}
      />
      {error ? <StyledText>{error}</StyledText> : null}
      {busy ? <StyledText>Preparing connection…</StyledText> : null}
      {error ? (
        <PrimaryButton
          accessibilityLabel="Play singleplayer instead"
          accessibilityRole="button"
          label="Play singleplayer instead"
          onPress={() => router.replace({ pathname: "/setup", params: { mode: "singleplayer" } })}
        />
      ) : null}

      {!state ? (
        <>
          <Title>Multiplayer</Title>
          <StyledText>
            Host a game, then invite other players to join. Keep the host app open while playing.
          </StyledText>
          {!role ? (
            <>
              <ActionButton
                label="Host game"
                onPress={() => router.replace({ pathname: "/setup", params: { mode: "multiplayer", host: "true" } })}
                busy={busy}
              />
              <ActionButton label="Join game" onPress={chooseGuest} busy={busy} />
            </>
          ) : null}
          {role === "host" ? (
            <>
              <StyledText>Host settings: {settings.difficulty} · Seed {settings.seed}</StyledText>
              <StyledText>Connected players: {ready.length + 1} (including you)</StyledText>
              {lobbyPlayers.map(id => (
                <NormalButton
                  key={id}
                  accessibilityLabel={`Remove ${id}`}
                  accessibilityRole="button"
                  label={`${id}: ${ready.includes(id) ? "connected" : "connecting"} · Remove`}
                  onPress={() => removePlayer(id)}
                />
              ))}
              {!pendingId ? (
                <ActionButton label="Add player" onPress={() => void addGuest()} busy={busy} />
              ) : (
                <>
                  <StyledText>1. Long-press to copy this invitation and send it to the joining device.</StyledText>
                  <LobbyTextBox editable={false} label="Host invitation" onChangeText={setIncoming} value={outgoing} />
                  <StyledText>2. Paste the player reply below.</StyledText>
                  <LobbyTextBox editable label="Player reply" onChangeText={setIncoming} value={incoming} />
                  <ActionButton label="Accept reply" onPress={() => void accept()} busy={busy} />
                  <ActionButton label="Cancel invitation" onPress={cancelInvitation} busy={busy} />
                </>
              )}
              <ActionButton label="Start together" onPress={start} busy={busy} />
            </>
          ) : null}
          {role === "guest" ? (
            <>
              <StyledText>The host chooses the seed and difficulty for everyone.</StyledText>
              {!outgoing ? (
                <>
                  <LobbyTextBox editable label="Paste host invitation" onChangeText={setIncoming} value={incoming} />
                  <ActionButton label="Create reply" onPress={() => void join()} busy={busy} />
                </>
              ) : (
                <>
                  <StyledText>Long-press to copy this reply and send it back to the host.</StyledText>
                  <LobbyTextBox editable={false} label="Reply for host" onChangeText={setIncoming} value={outgoing} />
                  <StyledText>
                    {connected ? "Connected. Waiting for the host to start…" : "Waiting for the host to accept your reply…"}
                  </StyledText>
                </>
              )}
            </>
          ) : null}
        </>
      ) : player && map && snapshot ? (
        <>
          {!tinyLayout ? <StyledText>{combatMessage || `${isTestSeed(state.seed) ? "TEST · " : ""}Level ${state.level} · Turn ${state.turn + 1} · You: ${playerId}`}</StyledText> : null}
          {!compactLayout ? <StyledText>{getPlayerStatus(state.ended, state.level, player.health, submitted === state.turn)}</StyledText> : null}
          {!tinyLayout && state.difficulty === "hard" ? (
            <StyledText>
              {role === "host" ? `Time left: ${seconds}s` : "The host controls the turn timer. Missing actions are skipped; enemies still attack."}
            </StyledText>
          ) : null}
          {!tinyLayout ? (
            <View style={{ flexShrink: 1, maxHeight: compactLayout ? 116 : undefined, minHeight: 0 }}>
              <DungeonMap
                map={map}
                currentRoomId={player.roomId}
                compact={compactLayout}
                players={Object.values(state.players).map(otherPlayer => ({
                  id: otherPlayer.id,
                  roomId: otherPlayer.roomId,
                  color: getMultiplayerPlayerAuraColor(Object.keys(state.players), otherPlayer.id),
                }))}
              />
            </View>
          ) : null}

          <Row style={{ height: 80, flexShrink: 0, gap: 6 }}>
            {settings.handedness === "left" ? (
              <>
                <ChargeControl
                  charged={charged}
                  chargeCost={getEquipmentStats(player.equipment).chargeCost}
                  disabled={state.ended || player.health <= 0 || submitted === state.turn || player.energy < getEquipmentStats(player.equipment).chargeCost}
                  onPress={toggleCharge}
                />
                <ItemControl targetRef={itemTargetRef} itemLabel={snapshot.inventoryItemLabel} itemSprite={snapshot.inventoryItemSprite} onPress={() => setItemDetailsOpen(true)} />
                <EquipmentControl targetRef={equipmentTargetRef} label={snapshot.equipmentLabel} sprite={snapshot.equipmentSprite} disabled={submitted === state.turn || player.health <= 0 || state.ended} onPress={() => setEquipmentDetailsOpen(true)} />
              </>
            ) : (
              <>
                <EquipmentControl targetRef={equipmentTargetRef} label={snapshot.equipmentLabel} sprite={snapshot.equipmentSprite} disabled={submitted === state.turn || player.health <= 0 || state.ended} onPress={() => setEquipmentDetailsOpen(true)} />
                <ItemControl targetRef={itemTargetRef} itemLabel={snapshot.inventoryItemLabel} itemSprite={snapshot.inventoryItemSprite} onPress={() => setItemDetailsOpen(true)} />
                <ChargeControl
                  charged={charged}
                  chargeCost={getEquipmentStats(player.equipment).chargeCost}
                  disabled={state.ended || player.health <= 0 || submitted === state.turn || player.energy < getEquipmentStats(player.equipment).chargeCost}
                  onPress={toggleCharge}
                />
              </>
            )}
          </Row>

          <ResourceBarGroup
            compact={compactLayout}
            playerSprite={getGameClass(player.classId).sprite}
            playerAuraColor={getMultiplayerPlayerAuraColor(Object.keys(state.players), playerId)}
          >
            <ResourceBar
              testID="multiplayer-health"
              accessibilityLabel="Player health"
              color={colors.health}
              current={player.health}
              max={PLAYER_MAX_HEALTH}
              icon="heart"
              panelPosition="first"
              compact={compactLayout}
            />
            <ResourceBar
              testID="multiplayer-energy"
              accessibilityLabel="Player energy"
              color={colors.energy}
              current={player.energy}
              max={PLAYER_MAX_ENERGY}
              icon="bolt"
              panelPosition="last"
              compact={compactLayout}
            />
          </ResourceBarGroup>

          <View style={{ flex: 1, minHeight: 0, overflow: "hidden", position: "relative", zIndex: microgame.active ? 100 : undefined }}>
          {tinyLayout && combatMessage ? <Text pointerEvents="none" style={{ position: "absolute", top: 8, left: 0, right: 0, zIndex: 20, color: colors.accent, fontWeight: "900", textAlign: "center" }}>{combatMessage}</Text> : null}
          <GameViewPanel
            disabled={state.phase !== "playing" || state.ended || disconnected || submitted === state.turn || microgame.active || itemDetailsOpen || equipmentDetailsOpen}
            pauseAnimations={microgame.active}
            reducedMotion={settings.reducedMotion}
            playerLabel={`${getGameClass(player.classId).name} · ${playerId} · Support`}
            playerSprite={getGameClass(player.classId).sprite}
            playerAuraColor={getMultiplayerPlayerAuraColor(Object.keys(state.players), playerId)}
            canUnlockDoors={player.item === "key" || player.classId === "thief"}
            canPassBlockedDoorways={player.health <= 0}
            roomDoorways={snapshot.roomDoorways}
            roomSceneActors={getMultiplayerRoomActors(snapshot.roomSceneActors, Object.values(state.players), player.roomId, playerId)}
            hardTurnCounter={state.difficulty === "easy" ? null : state.turnsLeft}
            onPlayerPress={() => submitAfterDefense({ type: "SUPPORT", target: playerId })}
            onDoorwayPress={position => submitAfterDefense({ type: "MOVE", target: getDirection(position) })}
            onActorPress={actor => {
              if (player.health <= 0 && actor.kind !== "enemy" && actor.kind !== "player") return;
              if (actor.kind === "player") {
                submitAfterDefense({ type: "SUPPORT", target: actor.id });
                return;
              }
              if (actor.kind === "enemy") {
                const werewolfWithSilver = !!state.map.entities.monsters[actor.id]?.chases && player.item === "silver-bullet";
                if (werewolfWithSilver) {
                  setCombatMessage("Silver Arrow worked! The Werewolf is defeated.");
                  submitAfterDefense({ type: "ATTACK", target: actor.id });
                } else if (player.health > 0 && settings.microgamesEnabled) {
                  pendingAttack.current = actor.id;
                  microgameMode.current = "attack";
                  microgame.start(getGameClass(player.classId).microgame, settings.handedness, { difficulty: state.difficulty, level: state.level });
                } else {
                  submitAfterDefense({ type: "ATTACK", target: actor.id });
                }
                return;
              }

              const actionType = actor.kind === "equipment"
                ? "PICKUP_EQUIPMENT"
                : actor.kind === "item" ? "PICKUP" : "DESCEND";
              submitAfterDefense({ type: actionType, target: actor.id });
            }}
          />
          <MicrogameOverlay
            visible={microgame.active}
            kind={microgame.kind}
            elapsedStore={microgame.elapsedStore}
            targetDelay={microgame.targetDelay}
            targetSpot={microgame.targetSpot}
            multitapTargetSpot={microgame.multitapTargetSpot}
            leftHanded={settings.handedness === "left"}
            onTap={microgame.tap}
          />
          <ItemDetailsMenu visible={itemDetailsOpen && !!snapshot.inventoryItemLabel} label={snapshot.inventoryItemLabel ?? "Item"} description={snapshot.inventoryItemDescription ?? "A useful item."} activationDescription={snapshot.inventoryItemActivationDescription ?? "This item activates automatically when its condition is met."} onClose={() => setItemDetailsOpen(false)} />
          <EquipmentDetailsMenu visible={equipmentDetailsOpen && !!snapshot.equipmentLabel} label={snapshot.equipmentLabel ?? "Equipment"} description={snapshot.equipmentDescription ?? "Equipment provides its listed effects while carried."} dropDisabled={submitted === state.turn || player.health <= 0 || state.ended} onDrop={() => { submitAfterDefense({ type: "DROP_EQUIPMENT" }); setEquipmentDetailsOpen(false); }} onClose={() => setEquipmentDetailsOpen(false)} />
          </View>

          {storedScore === null ? null : <StyledText>Last microgame score: {storedScore}/100</StyledText>}

          {state.phase === "briefing" ? (
            <ClassBriefing
              page={introPage}
              classId={player.classId}
              damage={10 + getEquipmentStats(player.equipment).attack}
              multiplayer
              auraColor={getMultiplayerPlayerAuraColor(Object.keys(state.players), playerId)}
              microgamesEnabled={settings.microgamesEnabled}
              onNext={() => setIntroPage(1)}
              onBack={() => setIntroPage(0)}
              onPractice={() => microgame.start(getGameClass(player.classId).microgame, settings.handedness, { difficulty: state.difficulty, level: state.level })}
              onStart={() => {
                setIntroPage(-1);
                submit({ type: "CLASS_READY" });
              }}
            />
          ) : null}
        </>
      ) : (
        <StyledText>You are no longer part of this game. Leave and rejoin a new lobby.</StyledText>
      )}
      </>
      )}
    </ScreenShell>
  );
}

function LobbyTextBox({
  value,
  editable,
  label,
  onChangeText,
}: {
  value: string;
  editable: boolean;
  label: string;
  onChangeText: (value: string) => void;
}) {
  const colors = useThemeColors();
  const style = {
    color: colors.ink,
    borderColor: colors.sepia,
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    minHeight: 48,
    maxHeight: 100,
  } as const;

  if (!editable) {
    return (
      <Text selectable accessibilityLabel={label} style={{ color: colors.ink, padding: 12 }}>
        {value}
      </Text>
    );
  }

  return (
    <TextInput
      accessibilityLabel={label}
      multiline
      selectTextOnFocus
      editable
      value={value}
      onChangeText={onChangeText}
      autoCorrect={false}
      autoCapitalize="none"
      style={style}
    />
  );
}

function getPlayerStatus(
  ended: boolean,
  level: number,
  health: number,
  submitted: boolean,
) {
  if (ended) return `Run complete · ${level - 1} levels cleared`;
  if (health <= 0) return "You are a ghost. Move through any doorway, attack for 5 damage (except the Werewolf), or support yourself or an ally for +5 damage on their next attack.";
  if (submitted) return "Action submitted. Waiting for other players…";
  return "Tap a monster to attack, an item to pick it up, a doorway to move, self or ally to support, or stairs to descend.";
}

function getDirection(position: "top" | "bottom" | "left" | "right") {
  return { top: "north", bottom: "south", left: "west", right: "east" }[position];
}

function ActionButton({ label, onPress, busy }: { label: string; onPress: () => void; busy: boolean }) {
  return (
    <PrimaryButton
      accessibilityLabel={label}
      accessibilityRole="button"
      label={label}
      onPress={() => {
        if (!busy) onPress();
      }}
    />
  );
}
