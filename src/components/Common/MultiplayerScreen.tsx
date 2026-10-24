import { useEffect, useRef, useState, type RefObject } from "react";
import { Platform, Text, TextInput, View, useWindowDimensions } from "react-native";

import { ClassBriefing } from "@/components/Common/ClassBriefing";
import { Row, StyledText, Title } from "@/components/Common/Displays";
import { MicrogameOverlay } from "@/components/Common/MicrogameOverlay";
import { ScreenShell } from "@/components/Common/ScreenShell";
import { animateSpriteFlight, measureViewCenter } from "@/components/Common/SpriteFlight";
import { useThemeColors } from "@/components/Common/theme";
import { NormalButton, PrimaryButton } from "@/components/Controls/ActionButton";
import { ChargeControl, EquipmentControl, ItemControl } from "@/components/Controls/ActionMenu";
import { DungeonMap } from "@/components/Dungeon/DungeonMap";
import { GameViewPanel } from "@/components/Dungeon/GameViewPanel";
import { ResourceBar, ResourceBarGroup } from "@/components/Player/PlayerHUD";
import { getEquipmentStats } from "@/game/actions/items";
import { useMicrogame } from "@/game/actions/use-microgame";
import { getGameClass } from "@/game/config/game-classes";
import { useRunMultiplayerGame } from "@/game/engine/run-game-multiplayer";
import { getMultiplayerPlayerAuraColor, getMultiplayerRoomActors } from "@/game/engine/multiplayer-presentation";
import { PLAYER_MAX_ENERGY, PLAYER_MAX_HEALTH } from "@/game/state/types";
import type { GameSettings } from "@/utils/settings-storage";
import { isTestSeed } from "@/utils/seed";

export function MultiplayerScreen({ settings, onLeave, onHostSelect, onOptionsSelect, startAsHost = false, startRequest = 0, hidden = false }: {
  settings: GameSettings;
  onLeave: () => void;
  onHostSelect: () => void;
  onOptionsSelect?: () => void;
  startAsHost?: boolean;
  startRequest?: number;
  hidden?: boolean;
}) {
  return <View style={hidden ? { display: "none" } : undefined}><Multiplayer settings={settings} onLeave={onLeave} onHostSelect={onHostSelect} onOptionsSelect={onOptionsSelect} startAsHost={startAsHost} startRequest={startRequest} /></View>;
}

function Multiplayer({ settings, onLeave, onHostSelect, onOptionsSelect, startAsHost, startRequest }: {
  settings: GameSettings;
  onLeave: () => void;
  onHostSelect: () => void;
  onOptionsSelect?: () => void;
  startAsHost: boolean;
  startRequest: number;
}) {
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
    leave,
    toggleCharge,
  } = useRunMultiplayerGame(settings);
  const isWeb = Platform.OS === "web";

  const [introPage, setIntroPage] = useState(0);
  const [storedScore, setStoredScore] = useState<number | null>(null);
  const [combatMessage, setCombatMessage] = useState("");
  const pendingAttack = useRef<string | null>(null);
  const itemTargetRef = useRef<View>(null);
  const equipmentTargetRef = useRef<View>(null);
  const hostStartedRef = useRef(false);
  useEffect(() => {
    if (startAsHost && !hostStartedRef.current) {
      hostStartedRef.current = true;
      hostGame();
    }
  }, [hostGame, startAsHost]);
  const previousStartRequest = useRef(startRequest);
  useEffect(() => {
    if (startRequest === previousStartRequest.current) return;
    previousStartRequest.current = startRequest;
    start();
  }, [startRequest, start]);
  const microgame = useMicrogame(score => {
    setStoredScore(score);
    const target = pendingAttack.current;
    pendingAttack.current = null;
    if (target) submit({ type: "ATTACK", target, microgameScore: score });
  });

  return (
    <ScreenShell compact={!!state}>
      {disconnected ? (
        <>
          <StyledText>{error || "Disconnected from the host. Leave and join a new lobby."}</StyledText>
          <NormalButton
            accessibilityLabel="Leave multiplayer"
            accessibilityRole="button"
            label="Leave multiplayer"
            onPress={() => { if (isWeb) leave(); onLeave(); }}
          />
        </>
      ) : (
      <>
      <NormalButton
        accessibilityLabel="Leave multiplayer"
        accessibilityRole="button"
        label="Leave multiplayer"
        onPress={() => { if (isWeb) leave(); onLeave(); }}
      />
      {error ? <StyledText>{error}</StyledText> : null}
      {busy ? <StyledText>Preparing connection…</StyledText> : null}

      {!state ? (
        <>
          <Title>Multiplayer</Title>
          <StyledText>
            {isWeb ? "Host a room, or join with a room code from another browser." : "Host a game, then invite other players to join. Keep the host app open while playing."}
          </StyledText>
          {!role ? (
            <>
              <ActionButton label="Host game" onPress={onHostSelect} busy={busy} />
              <ActionButton label="Join game" onPress={chooseGuest} busy={busy} />
            </>
          ) : null}
          {role === "host" ? (
            <>
              <StyledText>Connected players: {ready.length + 1} (including you)</StyledText>
              {isWeb ? <><StyledText>Room code</StyledText><Text selectable accessibilityLabel="Room code" style={{ color: colors.ink, fontSize: 28, fontWeight: "800", textAlign: "center", letterSpacing: 4 }}>{outgoing}</Text></> : null}
              {lobbyPlayers.map(id => isWeb ? (
                <StyledText key={id}>{id}: connected</StyledText>
              ) : (
                <NormalButton
                  key={id}
                  accessibilityLabel={`Remove ${id}`}
                  accessibilityRole="button"
                  label={`${id}: ${ready.includes(id) ? "connected" : "connecting"} · Remove`}
                  onPress={() => removePlayer(id)}
                />
              ))}
              {!isWeb && !pendingId ? (
                <ActionButton label="Add player" onPress={() => void addGuest()} busy={busy} />
              ) : !isWeb ? (
                <>
                  <StyledText>1. Long-press to copy this invitation and send it to the joining device.</StyledText>
                  <LobbyTextBox editable={false} label="Host invitation" onChangeText={setIncoming} value={outgoing} />
                  <StyledText>2. Paste the player reply below.</StyledText>
                  <LobbyTextBox editable label="Player reply" onChangeText={setIncoming} value={incoming} />
                  <ActionButton label="Accept reply" onPress={() => void accept()} busy={busy} />
                  <ActionButton label="Cancel invitation" onPress={cancelInvitation} busy={busy} />
                </>
              ) : null}
              {ready.length > 0 ? <ActionButton label="Game options" onPress={() => onOptionsSelect?.()} busy={busy} /> : <StyledText>Join this room from another browser to continue to game options.</StyledText>}
            </>
          ) : null}
          {role === "guest" ? (
            <>
              {isWeb
                ? connected
                  ? <StyledText>Joined room {outgoing}. Waiting for the host to start…</StyledText>
                  : <StyledText>Enter the host's room code. The room server supplies its seed and difficulty.</StyledText>
                : <StyledText>The host chooses the seed and difficulty for everyone.</StyledText>}
              {(!isWeb && !outgoing) || (isWeb && !connected) ? (
                <>
                  <LobbyTextBox
                    autoCapitalize={isWeb ? "characters" : "none"}
                    editable
                    label={isWeb ? "Room code" : "Paste host invitation"}
                    onChangeText={setIncoming}
                    value={incoming}
                  />
                  <ActionButton label={isWeb ? "Join room" : "Create reply"} onPress={() => void join()} busy={busy} />
                </>
              ) : !isWeb ? (
                <>
                  <StyledText>Long-press to copy this reply and send it back to the host.</StyledText>
                  <LobbyTextBox editable={false} label="Reply for host" onChangeText={setIncoming} value={outgoing} />
                  <StyledText>
                    {connected ? "Connected. Waiting for the host to start…" : "Waiting for the host to accept your reply…"}
                  </StyledText>
                </>
              ) : null}
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

          <Row style={{ height: 148, flexShrink: 0 }}>
            {settings.handedness === "left" ? (
              <>
                <ChargeControl
                  charged={charged}
                  chargeCost={getEquipmentStats(player.equipment).chargeCost}
                  disabled={state.ended || player.health <= 0 || submitted === state.turn || player.energy < getEquipmentStats(player.equipment).chargeCost}
                  onPress={toggleCharge}
                />
                <EquipmentInventoryControls
                  snapshot={snapshot}
                  disabled={submitted === state.turn || player.health <= 0 || state.ended}
                  onDrop={() => submit({ type: "DROP_EQUIPMENT" })}
                  itemTargetRef={itemTargetRef}
                  equipmentTargetRef={equipmentTargetRef}
                />
              </>
            ) : (
              <>
                <EquipmentInventoryControls
                  snapshot={snapshot}
                  disabled={submitted === state.turn || player.health <= 0 || state.ended}
                  onDrop={() => submit({ type: "DROP_EQUIPMENT" })}
                  itemTargetRef={itemTargetRef}
                  equipmentTargetRef={equipmentTargetRef}
                />
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
            disabled={state.phase !== "playing" || state.ended || disconnected || submitted === state.turn || microgame.active}
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
            onPlayerPress={() => submit({ type: "SUPPORT", target: playerId })}
            onDoorwayPress={position => submit({ type: "MOVE", target: getDirection(position) })}
            onActorPress={async (actor, source) => {
              if (player.health <= 0 && actor.kind !== "enemy" && actor.kind !== "player") return;
              if (actor.kind === "player") {
                submit({ type: "SUPPORT", target: actor.id });
                return;
              }
              if (actor.kind === "enemy") {
                const werewolfWithSilver = !!state.map.entities.monsters[actor.id]?.chases && player.item === "silver-bullet";
                if (werewolfWithSilver) {
                  setCombatMessage("Silver Bullet worked! The Werewolf is defeated.");
                  submit({ type: "ATTACK", target: actor.id });
                } else if (player.health > 0 && settings.microgamesEnabled) {
                  pendingAttack.current = actor.id;
                  microgame.start(getGameClass(player.classId).microgame, settings.handedness, { difficulty: state.difficulty, level: state.level });
                } else {
                  submit({ type: "ATTACK", target: actor.id });
                }
                return;
              }

              const actionType = actor.kind === "equipment"
                ? "PICKUP_EQUIPMENT"
                : actor.kind === "item" ? "PICKUP" : "DESCEND";
              if (actor.kind === "item" || actor.kind === "equipment") {
                const isEquipment = actor.kind === "equipment";
                const slotFull = isEquipment ? !!player.equipment : !!player.item;
                if (!(actor.isChest && slotFull) && source && actor.contentSprite) {
                  const target = await measureViewCenter(isEquipment ? equipmentTargetRef.current : itemTargetRef.current);
                  if (target) animateSpriteFlight({ start: source, end: target, sprite: actor.contentSprite, label: actor.label });
                }
              }
              submit({ type: actionType, target: actor.id });
            }}
          />
          <MicrogameOverlay
            visible={microgame.active}
            kind={microgame.kind}
            elapsedStore={microgame.elapsedStore}
            targetDelay={microgame.targetDelay}
            targetSpot={microgame.targetSpot}
            leftHanded={settings.handedness === "left"}
            onTap={microgame.tap}
          />
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
  autoCapitalize = "none",
}: {
  value: string;
  editable: boolean;
  label: string;
  onChangeText: (value: string) => void;
  autoCapitalize?: "none" | "characters";
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
      onChangeText={value => onChangeText(autoCapitalize === "characters" ? value.toUpperCase() : value)}
      autoCorrect={false}
      autoCapitalize={autoCapitalize}
      style={style}
    />
  );
}

function EquipmentInventoryControls({
  snapshot,
  disabled,
  onDrop,
  itemTargetRef,
  equipmentTargetRef,
}: {
  snapshot: NonNullable<ReturnType<typeof useRunMultiplayerGame>["snapshot"]>;
  disabled: boolean;
  onDrop: () => void;
  itemTargetRef: RefObject<View | null>;
  equipmentTargetRef: RefObject<View | null>;
}) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <EquipmentControl
        targetRef={equipmentTargetRef}
        label={snapshot.equipmentLabel}
        description={snapshot.equipmentDescription}
        sprite={snapshot.equipmentSprite}
        onDrop={onDrop}
        disabled={disabled}
      />
      <ItemControl
        targetRef={itemTargetRef}
        activationDescription={snapshot.inventoryItemActivationDescription}
        itemLabel={snapshot.inventoryItemLabel}
        itemSprite={snapshot.inventoryItemSprite}
      />
    </View>
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
