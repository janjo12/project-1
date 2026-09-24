import { router } from "expo-router";
import { useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";

import { DungeonMap } from "@/components/dungeon-map";
import { ChargeControl, EquipmentControl, ItemControl } from "@/components/game-controls";
import { ClassBriefing } from "@/components/class-briefing";
import { Title, StyledText, Row } from "@/components/displays";
import { GameViewPanel } from "@/components/game-view-panel";
import { MicrogameOverlay } from "@/components/microgame-overlay";
import { NormalButton, PrimaryButton } from "@/components/inputs";
import { ResourceBar, ResourceBarGroup } from "@/components/resource-bar";
import { ScreenShell } from "@/components/screen-shell";
import { ThemeProvider, useThemeColors } from "@/components/theme";
import { getGameClass } from "@/game-classes";
import { useGameSettings } from "@/hooks/use-game-settings";
import { getEquipmentStats } from "@/hooks/run-game-items";
import { PLAYER_MAX_ENERGY, PLAYER_MAX_HEALTH } from "@/hooks/run-game-types";
import { useMicrogame } from "@/hooks/use-microgame";
import { useRunMultiplayerGame } from "@/hooks/run-game-multiplayer";
import type { GameSettings } from "@/utils/settings-storage";

export default function MultiplayerRoute() {
  const { settings, isLoading } = useGameSettings();
  if (isLoading) return null;

  return (
    <ThemeProvider appearance={settings.appearance}>
      <Multiplayer settings={settings} />
    </ThemeProvider>
  );
}

function Multiplayer({ settings }: { settings: GameSettings }) {
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
  const pendingAttack = useRef<string | null>(null);
  const microgame = useMicrogame(score => {
    setStoredScore(score);
    const target = pendingAttack.current;
    pendingAttack.current = null;
    if (target) submit({ type: "ATTACK", target, microgameScore: score });
  });

  return (
    <ScreenShell compact={!!state}>
      <NormalButton
        accessibilityLabel="Leave multiplayer"
        accessibilityRole="button"
        label="Leave multiplayer"
        onPress={() => router.replace("/")}
      />
      {error ? <StyledText>{error}</StyledText> : null}
      {busy ? <StyledText>Preparing connection…</StyledText> : null}
      {disconnected ? <StyledText>Disconnected from the host. Leave and join a new lobby.</StyledText> : null}

      {!state ? (
        <>
          <Title>Same Wi-Fi multiplayer</Title>
          <StyledText>
            Connect every device to the same Wi-Fi. Keep the host app open while playing. Guest networks with device isolation may block connections.
          </StyledText>
          {!role ? (
            <>
              <ActionButton label="Host game" onPress={hostGame} busy={busy} />
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
          <StyledText>Level {state.level} · Turn {state.turn + 1} · You: {playerId}</StyledText>
          {state.phase === "playing" ? (
            <ActionButton
              label="Practice attack game"
              onPress={() => microgame.start(getGameClass(player.classId).microgame, settings.handedness)}
              busy={busy || submitted === state.turn || player.health <= 0}
            />
          ) : null}
          <StyledText>{getPlayerStatus(state.ended, state.level, player.health, submitted === state.turn)}</StyledText>
          {state.difficulty === "hard" ? (
            <StyledText>
              {role === "host" ? `Time left: ${seconds}s` : "The host controls the turn timer. Missing actions defend automatically."}
            </StyledText>
          ) : null}
          <StyledText>
            {Object.values(state.players).map(other => `${other.id}: ${other.roomId} · ${other.health} HP`).join("\n")}
          </StyledText>
          <DungeonMap map={map} currentRoomId={player.roomId} />

          <Row>
            {settings.handedness === "left" ? (
              <>
                <ChargeControl
                  charged={charged}
                  disabled={state.ended || player.health <= 0 || submitted === state.turn || player.energy < 1}
                  onPress={toggleCharge}
                />
                <EquipmentInventoryControls
                  snapshot={snapshot}
                  disabled={submitted === state.turn || player.health <= 0 || state.ended}
                  onDrop={() => submit({ type: "DROP_EQUIPMENT" })}
                />
              </>
            ) : (
              <>
                <EquipmentInventoryControls
                  snapshot={snapshot}
                  disabled={submitted === state.turn || player.health <= 0 || state.ended}
                  onDrop={() => submit({ type: "DROP_EQUIPMENT" })}
                />
                <ChargeControl
                  charged={charged}
                  disabled={state.ended || player.health <= 0 || submitted === state.turn || player.energy < 1}
                  onPress={toggleCharge}
                />
              </>
            )}
          </Row>

          <ResourceBarGroup>
            <ResourceBar
              testID="multiplayer-health"
              accessibilityLabel="Player health"
              color={colors.health}
              current={player.health}
              max={PLAYER_MAX_HEALTH}
              icon="heart"
              panelPosition="first"
            />
            <ResourceBar
              testID="multiplayer-energy"
              accessibilityLabel="Player energy"
              color={colors.energy}
              current={player.energy}
              max={PLAYER_MAX_ENERGY}
              icon="bolt"
              panelPosition="last"
            />
          </ResourceBarGroup>

          <GameViewPanel
            disabled={state.phase !== "playing" || state.ended || disconnected || player.health <= 0 || submitted === state.turn || microgame.active}
            reducedMotion={settings.reducedMotion}
            playerLabel={`${getGameClass(player.classId).name} · Support`}
            playerSprite={getGameClass(player.classId).sprite}
            canUnlockDoors={player.item === "key" || player.classId === "thief"}
            roomDoorways={snapshot.roomDoorways}
            roomSceneActors={snapshot.roomSceneActors}
            hardTurnCounter={state.difficulty === "easy" ? null : state.turnsLeft}
            onPlayerPress={() => submit({ type: "SUPPORT", target: playerId })}
            onDoorwayPress={position => submit({ type: "MOVE", target: getDirection(position) })}
            onActorPress={actor => {
              if (actor.kind === "enemy") {
                pendingAttack.current = actor.id;
                microgame.start(getGameClass(player.classId).microgame, settings.handedness);
                return;
              }

              const actionType = actor.kind === "equipment"
                ? "PICKUP_EQUIPMENT"
                : actor.kind === "item" ? "PICKUP" : "DESCEND";
              submit({ type: actionType, target: actor.id });
            }}
          />

          <Text style={{ color: colors.sepia }}>
            Everyone still alive must reach the stairs before the team descends. Fallen players return next level.
          </Text>
          {Object.values(state.players)
            .filter(ally => ally.id !== playerId && ally.roomId === player.roomId && ally.health > 0)
            .map(ally => (
              <ActionButton
                key={ally.id}
                label={`Support ally ${ally.id}`}
                onPress={() => submit({ type: "SUPPORT", target: ally.id })}
                busy={submitted === state.turn}
              />
            ))}
          {storedScore === null ? null : <StyledText>Last microgame score: {storedScore}/100</StyledText>}

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
          {state.phase === "briefing" ? (
            <ClassBriefing
              page={introPage}
              classId={player.classId}
              damage={10 + getEquipmentStats(player.equipment).attack}
              multiplayer
              onNext={() => setIntroPage(1)}
              onBack={() => setIntroPage(0)}
              onPractice={() => microgame.start(getGameClass(player.classId).microgame, settings.handedness)}
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
    padding: 12,
    minHeight: 100,
    maxHeight: 160,
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

function EquipmentInventoryControls({
  snapshot,
  disabled,
  onDrop,
}: {
  snapshot: NonNullable<ReturnType<typeof useRunMultiplayerGame>["snapshot"]>;
  disabled: boolean;
  onDrop: () => void;
}) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <EquipmentControl
        label={snapshot.equipmentLabel}
        description={snapshot.equipmentDescription}
        sprite={snapshot.equipmentSprite}
        onDrop={onDrop}
        disabled={disabled}
      />
      <ItemControl
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
  if (health <= 0) return "You fell. Spectating until your team reaches the next level.";
  if (submitted) return "Action submitted. Waiting for other players…";
  return "Tap a monster to attack, an item to pick it up, a doorway to move, your character to defend, or stairs to descend.";
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
