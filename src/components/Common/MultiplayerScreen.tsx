import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Text, TextInput, View, useWindowDimensions, type StyleProp, type TextStyle, type ViewInstance } from "react-native";

import { ClassBriefing } from "@/components/Common/ClassBriefing";
import { Container, Row, StyledText, Title } from "@/components/Common/Displays";
import { MicrogameOverlay } from "@/components/Common/MicrogameOverlay";
import { ScreenShell } from "@/components/Common/ScreenShell";
import { animateSpriteFlight, measureViewCenter } from "@/components/Common/SpriteFlight";
import { useThemeColors } from "@/components/Common/theme";
import { NormalButton, PrimaryButton, SegmentedButton, ToggleButton } from "@/components/Controls/ActionButton";
import { ChargeControl, EquipmentControl, ItemControl } from "@/components/Controls/ActionMenu";
import { DungeonMap } from "@/components/Dungeon/DungeonMap";
import { GameViewPanel } from "@/components/Dungeon/GameViewPanel";
import { EquipmentDetailsMenu, ItemDetailsMenu } from "@/components/Controls/InventoryDetailsMenu";
import { ResourceBar, ResourceBarGroup } from "@/components/Player/PlayerHUD";
import { getEquipmentStats } from "@/game/actions/items";
import { getBotPlayerName, isBotPlayerId, MAX_MULTIPLAYER_PLAYERS } from "@/game/engine/multiplayer-bot";
import { useMicrogame } from "@/game/actions/use-microgame";
import { getGameClass, getMicrogameEaseLevel } from "@/game/config/game-classes";
import { getConnectedRoomId, getRoom, getRoomMonster, unlockDoor } from "@/game/dungeon/rooms";
import { getPlayerAttackDamage, resolveAttackDamage } from "@/game/engine/combat";
import { useRunMultiplayerGame } from "@/game/engine/run-game-multiplayer";
import type { PlayerAction } from "@/game/engine/multiplayer-rules";
import { getMultiplayerPlayerAuraColor, getMultiplayerRoomActors } from "@/game/engine/multiplayer-presentation";
import { getTurnDuration } from "@/game/engine/resolveTurn";
import { getSupportFeedback } from "@/game/engine/support-feedback";
import { PLAYER_MAX_ENERGY, PLAYER_MAX_HEALTH } from "@/game/state/types";
import { advanceAnimationFrame, hasActiveCombatAnimation } from "@/game/entities";
import { createSceneFrameStore } from "@/game/state/sceneFrameStore";
import type { GameSettings } from "@/utils/settings-storage";
import { isTestSeed } from "@/utils/seed";

export function MultiplayerScreen({ settings, onLeave, onHostSelect, onOptionsSelect, onPlaySolo, startAsHost = false, startRequest = 0, hidden = false }: {
  settings: GameSettings;
  onLeave: () => void;
  onHostSelect: () => void;
  onOptionsSelect?: () => void;
  onPlaySolo?: () => void;
  startAsHost?: boolean;
  startRequest?: number;
  hidden?: boolean;
}) {
  return <View style={hidden ? { display: "none" } : undefined}><Multiplayer settings={settings} onLeave={onLeave} onHostSelect={onHostSelect} onOptionsSelect={onOptionsSelect} onPlaySolo={onPlaySolo} startAsHost={startAsHost} startRequest={startRequest} /></View>;
}

function Multiplayer({ settings, onLeave, onHostSelect, onOptionsSelect, onPlaySolo, startAsHost, startRequest }: {
  settings: GameSettings;
  onLeave: () => void;
  onHostSelect: () => void;
  onOptionsSelect?: () => void;
  onPlaySolo?: () => void;
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
    botIds,
    lobbyPlayers,
    readyPlayers,
    playerReady,
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
    addBot,
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
    playerOptions,
    setPlayerOptions,
  } = useRunMultiplayerGame(settings);
  const isWeb = Platform.OS === "web";
  const lobbyRoster = Array.from(new Set([...lobbyPlayers, ...botIds]));
  const lobbyIsFull = lobbyRoster.length + 1 >= MAX_MULTIPLAYER_PLAYERS;
  const hasTeammate = ready.length > 0 || botIds.length > 0;

  const [introPage, setIntroPage] = useState(0);
  const [combatMessage, setCombatMessage] = useState("");
  const [itemDetailsOpen, setItemDetailsOpen] = useState(false);
  const [equipmentDetailsOpen, setEquipmentDetailsOpen] = useState(false);
  const [supportEffect, setSupportEffect] = useState<{ targetId: string | null; emoji: string; label: string; key: number } | null>(null);
  const [damageDealtKey, setDamageDealtKey] = useState(0);
  const [combatAnimationStore] = useState(createSceneFrameStore);
  const combatAnimationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [combatTargetId, setCombatTargetId] = useState<string | null>(null);
  const previousPlayerHealth = useRef<number | null>(null);
  const pendingLocalAttack = useRef<{ targetId: string; health: number; turn: number } | null>(null);
  const pendingAttack = useRef<string | null>(null);
  const pendingDefenseAction = useRef<PlayerAction | null>(null);
  const microgameMode = useRef<"attack" | "defense" | "practice">("practice");
  const itemTargetRef = useRef<ViewInstance>(null);
  const equipmentTargetRef = useRef<ViewInstance>(null);
  const hostStartedRef = useRef(false);
  const tickCombatAnimation = useCallback(() => {
    const next = advanceAnimationFrame(combatAnimationStore.getSnapshot(), 16);
    combatAnimationStore.setFrame(next);
    if (hasActiveCombatAnimation(next)) {
      combatAnimationTimer.current = setTimeout(tickCombatAnimation, 16);
    } else {
      combatAnimationTimer.current = null;
      setCombatTargetId(null);
    }
  }, [combatAnimationStore]);
  const startCombatAnimation = useCallback(() => {
    if (combatAnimationTimer.current !== null) return;
    combatAnimationTimer.current = setTimeout(tickCombatAnimation, 16);
  }, [tickCombatAnimation]);
  const startLocalAttackMotion = useCallback((targetId?: string) => {
    setCombatTargetId(targetId ?? null);
    combatAnimationStore.setFrame(frame => ({ ...frame, playerAttackElapsed: 0 }));
    startCombatAnimation();
  }, [combatAnimationStore, startCombatAnimation]);
  const roomActors = useMemo(() => snapshot && state && player
    ? getMultiplayerRoomActors(snapshot.roomSceneActors, Object.values(state.players), player.roomId, playerId).map(actor => actor.kind === "enemy" && combatTargetId
      ? { ...actor, isActive: actor.id === combatTargetId }
      : actor)
    : [], [snapshot, state, player, playerId, combatTargetId]);
  const showRoomTimer = !!state && playerOptions.difficulty === "hard" && state.phase === "playing" && submitted !== state.turn;
  const roomTimerMaxSeconds = state ? Math.ceil(getTurnDuration({ difficulty: "hard", level: state.level }) / 1000) : 1;
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
  const microgame = useMicrogame(({ score, damageScore }) => {
    if (microgameMode.current === "defense") {
      const action = pendingDefenseAction.current;
      pendingDefenseAction.current = null;
      microgameMode.current = "practice";
      if (action) {
        if (action.type === "ATTACK") startLocalAttackMotion(action.target);
        submit({ ...action, defenseScore: score });
      }
      return;
    }
    const target = pendingAttack.current;
    pendingAttack.current = null;
    microgameMode.current = "practice";
    if (target) submitAfterDefense({ type: "ATTACK", target, microgameScore: damageScore });
  });

  useEffect(() => {
    const pending = pendingLocalAttack.current;
    if (!pending || !state) return;
    const target = state.map.entities.monsters[pending.targetId];
    if (target && target.currentHealth < pending.health) {
      setDamageDealtKey(key => key + 1);
      combatAnimationStore.setFrame(frame => ({ ...frame, enemyDamageElapsed: 0, enemyHealthLossElapsed: 0 }));
      startCombatAnimation();
      pendingLocalAttack.current = null;
    } else if (state.turn !== pending.turn) {
      pendingLocalAttack.current = null;
    }
  }, [combatAnimationStore, state, startCombatAnimation]);

  useEffect(() => {
    const health = player?.health ?? null;
    const previous = previousPlayerHealth.current;
    previousPlayerHealth.current = health;
    if (health !== null && previous !== null && health < previous) {
      combatAnimationStore.setFrame(frame => ({ ...frame, enemyAttackElapsed: 0, playerDamageElapsed: 0, playerHealthLossElapsed: 0 }));
      startCombatAnimation();
    }
  }, [combatAnimationStore, player?.health, startCombatAnimation]);

  useEffect(() => () => {
    if (combatAnimationTimer.current !== null) clearTimeout(combatAnimationTimer.current);
  }, []);

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
      // Entering a room is safe for this turn; enemies there only act after a
      // later action from that room. The server follows the same rule.
      if (destinationRoomId !== player.roomId) return false;
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
            profile: getPlayerAttackDamage(target, action.charged ?? charged, player.classId) + (player.empoweredAttackBonus ?? 0),
            score: Math.max(0, action.microgameScore ?? 100),
            equipmentAttack: getEquipmentStats(player.equipment).attack,
            charged: action.charged ?? charged,
            difficulty: playerOptions.difficulty,
            target,
          });
        if (damage >= target.currentHealth) return false;
      }
    }
    return true;
  }

  function submitAfterDefense(action: PlayerAction) {
    if (action.type === "ATTACK" && action.target && state) {
      const target = state.map.entities.monsters[action.target];
      pendingLocalAttack.current = target ? { targetId: action.target, health: target.currentHealth, turn: state.turn } : null;
    }
    if (!shouldRunDefense(action)) {
      microgameMode.current = "practice";
      if (action.type === "ATTACK") startLocalAttackMotion(action.target);
      submit(action);
      return;
    }
    pendingDefenseAction.current = action;
    microgameMode.current = "defense";
    microgame.start("defense", playerOptions.handedness, { difficulty: playerOptions.difficulty, level: state!.level, easeLevel: getMicrogameEaseLevel(player!.classId, player!.focusBoost) });
  }

  const gameViewActions = useRef<{
    playerPress: () => void;
    doorwayPress: (position: "top" | "bottom" | "left" | "right") => void;
    actorPress: (actor: import("@/components/Dungeon/Room").RoomSceneActor, source?: import("@/components/Dungeon/Room").ScreenPoint) => void;
  }>({ playerPress: () => undefined, doorwayPress: () => undefined, actorPress: () => undefined });
  gameViewActions.current = {
    playerPress: () => {
      setSupportEffect(previous => ({ targetId: null, ...getSupportFeedback(player?.classId ?? "warrior"), key: (previous?.key ?? 0) + 1 }));
      submitAfterDefense({ type: "SUPPORT", target: playerId });
    },
    doorwayPress: position => submitAfterDefense({ type: "MOVE", target: getDirection(position) }),
    actorPress: async (actor, source) => {
      if (!state || !player || (player.health <= 0 && actor.kind !== "enemy" && actor.kind !== "player")) return;
      if (actor.kind === "player") {
        setSupportEffect(previous => ({ targetId: actor.id, ...getSupportFeedback(player.classId), key: (previous?.key ?? 0) + 1 }));
        submitAfterDefense({ type: "SUPPORT", target: actor.id });
        return;
      }
      if (actor.kind === "enemy") {
        const werewolfWithSilver = !!state.map.entities.monsters[actor.id]?.chases && player.item === "silver-bullet";
        if (werewolfWithSilver) {
          setCombatMessage("Silver Arrow worked! The Werewolf is defeated.");
          submitAfterDefense({ type: "ATTACK", target: actor.id });
        } else if (player.health > 0 && playerOptions.microgamesEnabled) {
          pendingAttack.current = actor.id;
          microgameMode.current = "attack";
          microgame.start(getGameClass(player.classId).microgame, playerOptions.handedness, { difficulty: playerOptions.difficulty, level: state.level, easeLevel: getMicrogameEaseLevel(player.classId, player.focusBoost) });
        } else {
          submitAfterDefense({ type: "ATTACK", target: actor.id });
        }
        return;
      }
      const actionType = actor.kind === "equipment" ? "PICKUP_EQUIPMENT" : actor.kind === "item" ? "PICKUP" : "DESCEND";
      if (actor.kind === "item" || actor.kind === "equipment") {
        const isEquipment = actor.kind === "equipment";
        const slotFull = isEquipment ? !!player.equipment : !!player.item;
        if (!(actor.isChest && slotFull) && source && actor.contentSprite) {
          const target = await measureViewCenter(isEquipment ? equipmentTargetRef.current : itemTargetRef.current);
          if (target) animateSpriteFlight({ start: source, end: target, sprite: actor.contentSprite, label: actor.label });
        }
      }
      submitAfterDefense({ type: actionType, target: actor.id });
    },
  };
  const onGamePlayerPress = useCallback(() => gameViewActions.current.playerPress(), []);
  const onGameDoorwayPress = useCallback((position: "top" | "bottom" | "left" | "right") => gameViewActions.current.doorwayPress(position), []);
  const onGameActorPress = useCallback((actor: import("@/components/Dungeon/Room").RoomSceneActor, source?: import("@/components/Dungeon/Room").ScreenPoint) => gameViewActions.current.actorPress(actor, source), []);

  return (
    <ScreenShell compact={!!state} health={player?.health ?? null} damageDealtKey={damageDealtKey} reducedMotion={playerOptions.reducedMotion}>
      {disconnected ? (
        <>
          <StyledText>{error || "Disconnected from the host. Leave and join a new lobby."}</StyledText>
          {!isWeb && onPlaySolo ? <ActionButton label="Play singleplayer instead" onPress={onPlaySolo} busy={busy} /> : null}
          <NormalButton
            accessibilityLabel="Leave multiplayer"
            accessibilityRole="button"
            label="Leave multiplayer"
            onPress={() => { if (isWeb) leave(); onLeave(); }}
          />
        </>
      ) : (
      <>
      {!state?.ended ? (
        <NormalButton
          accessibilityLabel="Leave multiplayer"
          accessibilityRole="button"
          label="Leave multiplayer"
          onPress={() => { if (isWeb) leave(); onLeave(); }}
        />
      ) : null}
      {error ? <StyledText>{error}</StyledText> : null}
      {busy ? <StyledText>Preparing connection…</StyledText> : null}
      {!isWeb && error && onPlaySolo ? <ActionButton label="Play singleplayer instead" onPress={onPlaySolo} busy={busy} /> : null}

      {!state ? (
        <>
          {!(role === "guest" && connected) ? <Title>Multiplayer</Title> : null}
          {!role ? <StyledText>
            {isWeb ? "Host a room, or join with a room code from another browser." : "Host a game, then invite other players to join. Keep the host app open while playing."}
          </StyledText> : null}
          {!role ? (
            <>
              <ActionButton label="Host game" onPress={onHostSelect} busy={busy} />
              <ActionButton label="Join game" onPress={chooseGuest} busy={busy} />
            </>
          ) : null}
          {role === "host" ? (
            <>
              <StyledText>Players in room: {lobbyRoster.length + 1} (including you)</StyledText>
              {isWeb ? <><StyledText>Room code</StyledText><Text selectable accessibilityLabel="Room code" style={roomCodeTextStyle(colors.ink)}>{outgoing}</Text></> : null}
              {lobbyRoster.map(id => isWeb ? (
                <StyledText key={id}>{getBotPlayerName(id)}: {readyPlayers.includes(id) ? "ready" : "connected"}</StyledText>
              ) : isBotPlayerId(id) ? (
                <StyledText key={id}>{getBotPlayerName(id)}: ready</StyledText>
              ) : (
                <NormalButton
                  key={id}
                  accessibilityLabel={`Remove ${id}`}
                  accessibilityRole="button"
                  label={`${getBotPlayerName(id)}: ${ready.includes(id) ? "connected" : "connecting"} · Remove`}
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
              <ActionButton label="+ Add Bot" onPress={addBot} busy={busy || lobbyIsFull} />
              {isWeb
                ? hasTeammate ? <ActionButton label="Game options" onPress={() => onOptionsSelect?.()} busy={busy} /> : <StyledText>Add a bot or join this room from another browser to continue to game options.</StyledText>
                : <ActionButton label="Start together" onPress={start} busy={busy} />}
            </>
          ) : null}
          {role === "guest" ? (
            <>
              {isWeb
                ? connected
                  ? <>
                    <Title>Dungeon Run</Title>
                    <Row>
                      <StyledText>Difficulty</StyledText>
                      <SegmentedButton options={["easy", "normal", "hard"] as const} value={playerOptions.difficulty} onChange={difficulty => setPlayerOptions({ ...playerOptions, difficulty })} />
                    </Row>
                    <Row>
                      <StyledText>Attack microgames</StyledText>
                      <SegmentedButton options={["On", "Off"] as const} value={playerOptions.microgamesEnabled ? "On" : "Off"} onChange={choice => setPlayerOptions({ ...playerOptions, microgamesEnabled: choice === "On" })} />
                    </Row>
                    <StyledText>Turn off for direct attacks without a timing game.</StyledText>
                    <Row>
                      <StyledText>Handedness</StyledText>
                      <SegmentedButton options={["Right", "Left"] as const} value={playerOptions.handedness === "left" ? "Left" : "Right"} onChange={value => setPlayerOptions({ ...playerOptions, handedness: value.toLowerCase() as GameSettings["handedness"] })} />
                    </Row>
                    <ToggleButton label="Reduced motion" value={playerOptions.reducedMotion} onValueChange={value => setPlayerOptions({ ...playerOptions, reducedMotion: value })} />
                    <ActionButton label={playerReady ? "Ready" : "Start"} onPress={start} busy={busy || playerReady} />
                  </>
                  : <StyledText>Enter the host&apos;s room code. You&apos;ll choose your own difficulty and gameplay options after joining.</StyledText>
                : <StyledText>Choose your own gameplay options. The host sets the shared seed.</StyledText>}
              {!isWeb ? <>
                <Row>
                  <StyledText>Difficulty</StyledText>
                  <SegmentedButton options={["easy", "normal", "hard"] as const} value={playerOptions.difficulty} onChange={difficulty => setPlayerOptions({ ...playerOptions, difficulty })} />
                </Row>
                <SegmentedButton options={["Right", "Left"] as const} value={playerOptions.handedness === "left" ? "Left" : "Right"} onChange={value => setPlayerOptions({ ...playerOptions, handedness: value.toLowerCase() as GameSettings["handedness"] })} />
                <ToggleButton label="Attack mini-games" value={playerOptions.microgamesEnabled} onValueChange={value => setPlayerOptions({ ...playerOptions, microgamesEnabled: value })} />
                <ToggleButton label="Reduced motion" value={playerOptions.reducedMotion} onValueChange={value => setPlayerOptions({ ...playerOptions, reducedMotion: value })} />
                {outgoing && connected ? <ActionButton label={playerReady ? "Ready" : "Start"} onPress={start} busy={busy || playerReady} /> : null}
              </> : null}
              {(!isWeb && !outgoing) || (isWeb && !connected) ? (
                <>
                  <LobbyTextBox
                    autoCapitalize={isWeb ? "characters" : "none"}
                    editable
                    label={isWeb ? "Room code" : "Paste host invitation"}
                    onChangeText={setIncoming}
                    multiline={!isWeb}
                    maxLength={isWeb ? 6 : undefined}
                    inputStyle={isWeb ? roomCodeTextStyle(colors.ink) : undefined}
                    returnKeyType={isWeb ? "go" : undefined}
                    onSubmitEditing={isWeb ? () => { if (incoming.trim()) void join(); } : undefined}
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
          {state.ended ? (
            <Container style={{ alignItems: "center", flex: 1, justifyContent: "center" }}>
              <Title>Game Over</Title>
              <Title>{state.level - 1} Floor{state.level === 2 ? "" : "s"} Cleared</Title>
              <StyledText>{state.turnsLeft <= 0 ? "The party ran out of turns." : "The entire party has fallen."}</StyledText>
              <NormalButton
                accessibilityLabel="Return to Title"
                accessibilityRole="button"
                label="Return to Title"
                onPress={() => { if (isWeb) leave(); onLeave(); }}
              />
            </Container>
          ) : (
          <>
          {!tinyLayout ? <StyledText>{combatMessage || `${isTestSeed(state.seed) ? "TEST · " : ""}Level ${state.level} · Turn ${state.turn + 1} · You: ${playerId}`}</StyledText> : null}
          {!compactLayout ? <StyledText>{getPlayerStatus(state.level, player.health, submitted === state.turn)}</StyledText> : null}
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
            {playerOptions.handedness === "left" ? (
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
            {showRoomTimer ? (
              <ResourceBar
                testID="multiplayer-turn-timer"
                accessibilityLabel="Turn timer"
                color={colors.timer}
                current={seconds}
                max={roomTimerMaxSeconds}
                icon="hourglass-half"
                panelPosition="middle"
                compact={compactLayout}
              />
            ) : null}
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
            sceneFrameStore={combatAnimationStore}
            disabled={state.phase !== "playing" || state.ended || disconnected || submitted === state.turn || microgame.active}
            waitingForPlayers={submitted === state.turn}
            pauseAnimations={microgame.active}
            reducedMotion={playerOptions.reducedMotion}
            playerLabel={`${getGameClass(player.classId).name} · ${playerId} · Support`}
            playerSprite={getGameClass(player.classId).sprite}
            playerAuraColor={getMultiplayerPlayerAuraColor(Object.keys(state.players), playerId)}
            canUnlockDoors={player.item === "key" || player.classId === "thief"}
            canPassBlockedDoorways={player.health <= 0}
            roomDoorways={snapshot.roomDoorways}
            roomSceneActors={roomActors}
            hardTurnCounter={playerOptions.difficulty === "easy" ? null : state.turnsLeft}
            supportEffect={supportEffect}
            onPlayerPress={onGamePlayerPress}
            onDoorwayPress={onGameDoorwayPress}
            onActorPress={onGameActorPress}
          />
          <MicrogameOverlay
            visible={microgame.active}
            kind={microgame.kind}
            elapsedStore={microgame.elapsedStore}
            progress={microgame.actionProgress}
            targetDelay={microgame.targetDelay}
            targetSpot={microgame.targetSpot}
            multitapTargetSpot={microgame.multitapTargetSpot}
            multiswipeTarget={microgame.multiswipeTarget}
            leftHanded={playerOptions.handedness === "left"}
            onTap={microgame.tap}
            onSwipeStart={microgame.startSwipe}
            onSwipeEnd={microgame.endSwipe}
        onMultiswipeLayout={microgame.updateMultiswipeTarget}
        onRuneProgress={microgame.updateRuneProgress}
        onRuneComplete={progress => microgame.finishRuneTracer(true, progress)}
          />
          <ItemDetailsMenu visible={itemDetailsOpen && !!snapshot.inventoryItemLabel} label={snapshot.inventoryItemLabel ?? "Item"} description={snapshot.inventoryItemDescription ?? "A useful item."} activationDescription={snapshot.inventoryItemActivationDescription ?? "This item activates automatically when its condition is met."} showUseNow={snapshot.showUseItemNow} useNowDisabled={!snapshot.canUseItemNow || submitted === state.turn || player.health <= 0 || state.ended} onUseNow={() => { submitAfterDefense({ type: "USE_ITEM" }); setItemDetailsOpen(false); }} onClose={() => setItemDetailsOpen(false)} />
          <EquipmentDetailsMenu visible={equipmentDetailsOpen && !!snapshot.equipmentLabel} label={snapshot.equipmentLabel ?? "Equipment"} description={snapshot.equipmentDescription ?? "Equipment provides its listed effects while carried."} dropDisabled={submitted === state.turn || player.health <= 0 || state.ended} onDrop={() => { submitAfterDefense({ type: "DROP_EQUIPMENT" }); setEquipmentDetailsOpen(false); }} onClose={() => setEquipmentDetailsOpen(false)} />
          </View>

          {state.phase === "briefing" ? (
            <ClassBriefing
              page={introPage}
              classId={player.classId}
              damage={10 + getEquipmentStats(player.equipment).attack}
              multiplayer
              auraColor={getMultiplayerPlayerAuraColor(Object.keys(state.players), playerId)}
              microgamesEnabled={playerOptions.microgamesEnabled}
              onNext={() => setIntroPage(1)}
              onBack={() => setIntroPage(0)}
              onPracticeAttack={() => microgame.start(getGameClass(player.classId).microgame, playerOptions.handedness, { difficulty: playerOptions.difficulty, level: state.level, easeLevel: getMicrogameEaseLevel(player.classId, player.focusBoost) })}
              onPracticeDefense={() => microgame.start("defense", playerOptions.handedness, { difficulty: playerOptions.difficulty, level: state.level, easeLevel: getMicrogameEaseLevel(player.classId, player.focusBoost) })}
              onStart={() => {
                setIntroPage(-1);
                submit({ type: "CLASS_READY" });
              }}
            />
          ) : null}
          </>
          )}
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
  multiline = true,
  maxLength,
  inputStyle,
  returnKeyType,
  onSubmitEditing,
}: {
  value: string;
  editable: boolean;
  label: string;
  onChangeText: (value: string) => void;
  autoCapitalize?: "none" | "characters";
  multiline?: boolean;
  maxLength?: number;
  inputStyle?: StyleProp<TextStyle>;
  returnKeyType?: "go";
  onSubmitEditing?: () => void;
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
      multiline={multiline}
      maxLength={maxLength}
      returnKeyType={returnKeyType}
      onSubmitEditing={onSubmitEditing}
      selectTextOnFocus
      editable
      value={value}
      onChangeText={value => onChangeText(autoCapitalize === "characters" ? value.toUpperCase() : value)}
      autoCorrect={false}
      autoCapitalize={autoCapitalize}
      style={[style, inputStyle]}
    />
  );
}

function roomCodeTextStyle(color: string) {
  return { color, fontSize: 28, fontWeight: "800" as const, textAlign: "center" as const, letterSpacing: 4 };
}

function getPlayerStatus(
  level: number,
  health: number,
  submitted: boolean,
) {
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
      disabled={busy}
      onPress={() => {
        if (!busy) onPress();
      }}
    />
  );
}
