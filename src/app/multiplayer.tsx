import { router } from "expo-router";
import { TextInput, Text } from "react-native";
import { Title, StyledText } from "@/components/displays";
import { PrimaryButton, NormalButton } from "@/components/inputs";
import { ScreenShell } from "@/components/screen-shell";
import { ThemeProvider, useThemeColors } from "@/components/theme";
import { DungeonMap } from "@/components/dungeon-map";
import { GameViewPanel } from "@/components/game-view-panel";
import { ChargeControl, ItemControl } from "@/components/game-controls";
import { ResourceBar, ResourceBarGroup } from "@/components/resource-bar";
import { useGameSettings } from "@/hooks/use-game-settings";
import { useRunMultiplayerGame } from "@/hooks/run-game-multiplayer";
import { PLAYER_MAX_ENERGY, PLAYER_MAX_HEALTH } from "@/hooks/run-game-helpers";
import type { GameSettings } from "@/utils/settings-storage";

export default function MultiplayerRoute() {
  const { settings, isLoading } = useGameSettings();
  if (isLoading) return null;
  return <ThemeProvider appearance={settings.appearance}><Multiplayer settings={settings} /></ThemeProvider>;
}
function Multiplayer({ settings }: { settings: GameSettings }) {
  const colors = useThemeColors();
  const {
    role, playerId, state, outgoing, incoming, setIncoming, pendingId, ready,
    lobbyPlayers, error, busy, connected, submitted, charged, seconds, disconnected,
    player, map, snapshot, hostGame, start, submit, removePlayer, chooseGuest,
    addGuest, join, accept, cancelInvitation, toggleCharge,
  } = useRunMultiplayerGame(settings);
  const textBox = (value: string, editable: boolean, label: string) => !editable ? <Text selectable accessibilityLabel={label} style={{ color: colors.ink, padding: 12 }}>{value}</Text> : <TextInput accessibilityLabel={label}
    multiline selectTextOnFocus editable={editable} value={value} onChangeText={setIncoming} autoCorrect={false} autoCapitalize="none"
    style={{ color: colors.ink, borderColor: colors.sepia, borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 100, maxHeight: 160 }} />;
  return <ScreenShell compact={!!state}>
    <NormalButton accessibilityLabel="Leave multiplayer" accessibilityRole="button" label="Leave multiplayer" onPress={() => router.replace("/")} />
    {error ? <StyledText>{error}</StyledText> : null}
    {busy ? <StyledText>Preparing connection…</StyledText> : null}
    {disconnected ? <StyledText>Disconnected from the host. Leave and join a new lobby.</StyledText> : null}
    {!state ? <>
      <Title>Same Wi-Fi multiplayer</Title>
      <StyledText>Connect every device to the same Wi-Fi. Keep the host app open while playing. Guest networks with device isolation may block connections.</StyledText>
      {!role ? <><ActionButton label="Host game" onPress={hostGame} busy={busy} /><ActionButton label="Join game" onPress={chooseGuest} busy={busy} /></> : null}
      {role === "host" ? <>
        <StyledText>Host settings: {settings.difficulty} · Seed {settings.seed}</StyledText>
        <StyledText>Connected players: {ready.length + 1} (including you)</StyledText>
        {lobbyPlayers.map(id => <NormalButton key={id} accessibilityLabel={`Remove ${id}`} accessibilityRole="button"
          label={`${id}: ${ready.includes(id) ? "connected" : "connecting"} · Remove`}
          onPress={() => removePlayer(id)} />)}
        {!pendingId ? <ActionButton label="Add player" onPress={() => void addGuest()} busy={busy} /> : <>
          <StyledText>1. Long-press to copy this invitation and send it to the joining device.</StyledText>
          {textBox(outgoing, false, "Host invitation")}
          <StyledText>2. Paste the player reply below.</StyledText>
          {textBox(incoming, true, "Player reply")}
          <ActionButton label="Accept reply" onPress={() => void accept()} busy={busy} />
          <ActionButton label="Cancel invitation" onPress={cancelInvitation} busy={busy} />
        </>}
        <ActionButton label="Start together" onPress={start} busy={busy} />
      </> : null}
      {role === "guest" ? <>
        <StyledText>The host chooses the seed and difficulty for everyone.</StyledText>
        {!outgoing ? <>{textBox(incoming, true, "Paste host invitation")}<ActionButton label="Create reply" onPress={() => void join()} busy={busy} /></> : <>
          <StyledText>Long-press to copy this reply and send it back to the host.</StyledText>
          {textBox(outgoing, false, "Reply for host")}
          <StyledText>{connected ? "Connected. Waiting for the host to start…" : "Waiting for the host to accept your reply…"}</StyledText>
        </>}
      </> : null}
    </> : player && map && snapshot ? <>
      <StyledText>Level {state.level} · Turn {state.turn + 1} · You: {playerId}</StyledText>
      <StyledText>{state.ended ? `Run complete · ${state.level - 1} levels cleared` : player.health <= 0 ? "You fell. Spectating until your team reaches the next level." : submitted === state.turn ? "Action submitted. Waiting for other players…" : "Choose your action. Tap your character to defend."}</StyledText>
      {state.difficulty === "hard" ? <StyledText>{role === "host" ? `Time left: ${seconds}s` : "The host controls the turn timer. Missing actions defend automatically."}</StyledText> : null}
      <StyledText>{Object.values(state.players).map(p => `${p.id}: ${p.roomId} · ${p.health} HP`).join("\n")}</StyledText>
      <DungeonMap map={map} currentRoomId={player.roomId} />
      <ItemControl activationDescription={snapshot.inventoryItemActivationDescription} itemLabel={snapshot.inventoryItemLabel} itemSprite={snapshot.inventoryItemSprite} />
      <ChargeControl charged={charged} disabled={state.ended || player.health <= 0 || submitted === state.turn || player.energy < 1} onPress={toggleCharge} />
      <ResourceBarGroup>
        <ResourceBar testID="multiplayer-health" accessibilityLabel="Player health" color={colors.health} current={player.health} max={PLAYER_MAX_HEALTH} icon="heart" panelPosition="first" />
        <ResourceBar testID="multiplayer-energy" accessibilityLabel="Player energy" color={colors.energy} current={player.energy} max={PLAYER_MAX_ENERGY} icon="bolt" panelPosition="last" />
      </ResourceBarGroup>
      <GameViewPanel disabled={state.ended || disconnected || player.health <= 0 || submitted === state.turn}
        canUnlockDoors={player.item === "key"} roomDoorways={snapshot.roomDoorways} roomSceneActors={snapshot.roomSceneActors}
        hardTurnCounter={state.difficulty === "easy" ? null : state.turnsLeft}
        onPlayerPress={() => submit({ type: "DEFEND" })}
        onDoorwayPress={position => submit({ type: "MOVE", target: ({ top: "north", bottom: "south", left: "west", right: "east" })[position] })}
        onActorPress={actor => submit({ type: actor.kind === "enemy" ? "ATTACK" : actor.kind === "item" ? "PICKUP" : "DESCEND", target: actor.id })} />
      <Text style={{ color: colors.sepia }}>Everyone still alive must reach the stairs before the team descends. Fallen players return next level.</Text>
    </> : <StyledText>You are no longer part of this game. Leave and rejoin a new lobby.</StyledText>}
  </ScreenShell>;
}


function ActionButton({ label, onPress, busy }: { label: string; onPress: () => void; busy: boolean }) {
  return <PrimaryButton accessibilityLabel={label} accessibilityRole="button" label={label} onPress={() => { if (!busy) onPress(); }} />;
}


