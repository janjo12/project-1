import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";

import type { createClientConnection, createHostSession } from "@/multiplayer/connection";
import { describeMultiplayerFailure } from "@/multiplayer/multiplayer-errors";
import { getTurnDuration } from "@/game/engine/resolveTurn";
import { getMultiplayerPlayerView } from "@/game/engine/multiplayer-view";
import type { GameSettings } from "@/utils/settings-storage";
import type { MultiplayerPlayerOptions } from "@/multiplayer/player-options";
import { createMultiplayerState, isMultiplayerState, resolveMultiplayerTurn } from "@/game/engine/multiplayer-rules";
import type { MultiplayerState, PlayerAction } from "@/game/engine/multiplayer-rules";
export { createMultiplayerState, isMultiplayerState, resolveMultiplayerTurn } from "@/game/engine/multiplayer-rules";
export type { MultiplayerPlayer, MultiplayerState } from "@/game/engine/multiplayer-rules";
type Host = ReturnType<typeof createHostSession<MultiplayerState>>;
type Client = Awaited<ReturnType<typeof createClientConnection>>;
// Load native WebRTC only when hosting/joining, so singleplayer still works in Expo Go.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Native module must load inside the recoverable host/join action.
const networking = () => require("@/multiplayer/connection") as typeof import("@/multiplayer/connection");
const localOptions = (settings: GameSettings): MultiplayerPlayerOptions => ({ difficulty: settings.difficulty, handedness: settings.handedness, microgamesEnabled: settings.microgamesEnabled, reducedMotion: settings.reducedMotion });
function withLocalOptions(state: MultiplayerState, playerId: string, settings: GameSettings) {
  state.players[playerId].gameplayOptions = localOptions(settings);
  return state;
}


/** Owns the LAN session, lobby lifecycle, turn clock and local player view. */
export function useRunMultiplayerGame(settings: GameSettings) {
  const host = useRef<Host | null>(null);
  const client = useRef<Client | null>(null);
  const mounted = useRef(true);
  const busyRef = useRef(false);
  const nextGuest = useRef(2);
  const [role, setRole] = useState<"host" | "guest" | null>(null);
  const [playerId, setPlayerId] = useState("host");
  const [state, setState] = useState<MultiplayerState | null>(null);
  const [outgoing, setOutgoing] = useState("");
  const [incoming, setIncoming] = useState("");
  const [pendingId, setPendingId] = useState("");
  const [ready, setReady] = useState<string[]>([]);
  const [prepared, setPrepared] = useState<string[]>([]);
  const [playerReady, setPlayerReady] = useState(false);
  const [localPlayerOptions, setLocalPlayerOptions] = useState<MultiplayerPlayerOptions>(() => localOptions(settings));
  const [lobbyPlayers, setLobbyPlayers] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [submitted, setSubmitted] = useState<number | null>(null);
  const [charged, setCharged] = useState(false);
  const [microgameScore, setMicrogameScore] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [disconnected, setDisconnected] = useState(false);
  const [foreground, setForeground] = useState(true);
  const report = useCallback((e: unknown) => {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[multiplayer-client]", JSON.stringify({
      event: "operation_failed", operation: "native_session", playerId, role,
      message, name: e instanceof Error ? e.name : typeof e,
      stack: e instanceof Error ? e.stack : undefined,
      at: new Date().toISOString(),
    }));
    if (mounted.current) setError(describeMultiplayerFailure(e));
  }, [playerId, role]);
  function receive(next: MultiplayerState) {
    if (!mounted.current) return;
    setState(next); setCharged(false); setSubmitted(null);
  }
  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener("change", status => setForeground(status === "active"));
    return () => { mounted.current = false; subscription.remove(); host.current?.close(); client.current?.close(); };
  }, []);
  useEffect(() => {
    if (!state || state.ended || state.phase !== "playing" || role !== "host" || state.difficulty !== "hard" || !foreground) return;
    const duration = getTurnDuration({ difficulty: state.difficulty, level: state.level });
    const deadline = Date.now() + duration;

    const tick = setInterval(() => setSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000))), 250);
    const timeout = setTimeout(() => { try { host.current?.finishTurn(); } catch (e) { report(e); } }, duration);
    return () => { clearInterval(tick); clearTimeout(timeout); };
  }, [state, role, foreground, report]);

  async function run(task: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError("");
    try { await task(); } catch (e) { report(e); }
    finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  }
  function hostGame() {
    try {
      const api = networking();
      host.current = api.createHostSession<MultiplayerState>({
        hostPlayerId: "host", initialState: withLocalOptions(createMultiplayerState(settings.seed, settings.difficulty, ["host"]), "host", settings),
        connectionOptions: { configuration: { iceServers: [] } },
        resolveTurn: (previous, actions) => {
          const ids = new Set(["host", ...(host.current?.readyPlayerIds ?? [])]);
          const players = Object.fromEntries(Object.entries(previous.players).filter(([id]) => ids.has(id)));
          return resolveMultiplayerTurn({ ...previous, players }, actions);
        },
        // Fallen players remain active participants as ghosts until the shared descent revives them.
        isActivePlayer: (current, id) => !current.ended && current.players[id] !== undefined,
        onState: receive, onError: report,
        onPlayersChange: () => {
          if (mounted.current) {
            setReady(host.current?.readyPlayerIds ?? []);
            setLobbyPlayers(host.current?.playerIds ?? []);
          }
        },
        onReadinessChange: playerIds => { if (mounted.current) setPrepared(playerIds); },
      });
      setRole("host");
    } catch (error) { report(error); }
  }
  async function addGuest() {
    const id = `player-${nextGuest.current++}`;
    const text = await host.current!.addPlayer(id);
    if (!mounted.current) return;
    setLobbyPlayers(host.current?.playerIds ?? []);
    setPendingId(id); setOutgoing(JSON.stringify({ version: 1, playerId: id, offer: text })); setIncoming("");
  }
  async function join() {
    const invite: unknown = JSON.parse(incoming);
    if (!invite || typeof invite !== "object" || !("playerId" in invite) || !("offer" in invite) ||
        typeof invite.playerId !== "string" || typeof invite.offer !== "string") throw new Error("Paste the complete host invitation.");
    client.current?.close();
    const connection = await networking().createClientConnection(invite.offer, {
      configuration: { iceServers: [] },
      onError: error => {
        report(error);
        if (mounted.current) setDisconnected(true);
      },
      onOpen: () => { if (mounted.current) setConnected(true); },
      onClose: () => { if (mounted.current) { setDisconnected(true); setConnected(false); } },
      onMessage: message => {
        if (message.type !== "INITIAL_STATE" && message.type !== "TURN_RESULT") return;
        if (!isMultiplayerState(message.state)) { report(new Error("Host sent an incompatible game state.")); return; }
        receive(message.state);
      },
    });
    if (!mounted.current) { connection.close(); return; }
    client.current = connection; setPlayerId(invite.playerId); setDisconnected(false);
    setOutgoing(JSON.stringify({ playerId: invite.playerId, answer: connection.answerText }));
  }
  async function accept() {
    const reply = JSON.parse(incoming);
    if (reply.playerId !== pendingId || typeof reply.answer !== "string") throw new Error("This reply does not match the pending player.");
    await host.current!.acceptAnswer(pendingId, reply.answer);
    setIncoming(""); setOutgoing(""); setPendingId("");
  }
  function start() {
    try {
      if (role === "guest") { markReady(); return; }
      if (!ready.length) throw new Error("Connect at least one other device first.");
      if (ready.some(id => !prepared.includes(id))) throw new Error("Wait for every player to choose their options and press Start.");
      const next = createMultiplayerState(settings.seed, settings.difficulty, ["host", ...ready]);
      next.players.host.gameplayOptions = localOptions(settings);
      host.current!.start(next);
    } catch (e) { report(e); }
  }
  function setPlayerOptions(options: MultiplayerPlayerOptions) {
    setLocalPlayerOptions(options);
    setPlayerReady(false);
    if (host.current) host.current.setPlayerOptions(playerId, options);
    else client.current?.send({ type: "PLAYER_OPTIONS", options });
  }
  function markReady() {
    if (role !== "guest" || !connected || !client.current) {
      report(new Error("Wait for the host to connect before pressing Start."));
      return;
    }
    client.current.send({ type: "PLAYER_READY", options: localPlayerOptions });
    setPlayerReady(true);
  }
  function submit(action: PlayerAction) {
    if (!state || state.ended || disconnected || submitted === state.turn) return;
    setSubmitted(state.turn); setError("");
    try {
      const complete = { ...action, charged, ...(microgameScore === null ? {} : { microgameScore }) };
      if (host.current) {
        if (!host.current.submitHostAction(state.turn, complete)) setSubmitted(null);
      } else client.current!.send({ type: "SUBMIT_ACTION", turn: state.turn, action: complete });
      setMicrogameScore(null);
    } catch (e) { setSubmitted(null); report(e); }
  }

  const view = useMemo(() => getMultiplayerPlayerView(state, playerId), [state, playerId]);
  function removePlayer(id: string) {
    host.current?.removePlayer(id);
    if (id === pendingId) { setPendingId(""); setOutgoing(""); }
  }
  function leave() {
    host.current?.close(); host.current = null;
    client.current?.close(); client.current = null;
    setRole(null); setState(null); setConnected(false); setDisconnected(false);
    setSubmitted(null); setReady([]); setPrepared([]); setPlayerReady(false); setLobbyPlayers([]); setOutgoing(""); setIncoming(""); setPendingId("");
  }
  return {
    role, playerId, state, outgoing, incoming, setIncoming, pendingId, ready, prepared, readyPlayers: prepared, playerReady,
    lobbyPlayers, error, busy, connected, submitted, charged, seconds, disconnected,
    player: view.player, map: view.map, snapshot: view.snapshot, hostGame, start, submit, removePlayer,
    playerOptions: view.player?.gameplayOptions ?? localPlayerOptions,
    setPlayerOptions, markReady,
    chooseGuest: () => setRole("guest"),
    leave,
    addGuest: () => run(addGuest),
    join: () => run(join),
    accept: () => run(accept),
    cancelInvitation: () => removePlayer(pendingId),
    toggleCharge: () => setCharged(value => !value), microgameScore, setMicrogameScore,
  };
}
