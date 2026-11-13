import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getMultiplayerPlayerView } from "@/game/engine/multiplayer-view";
import type { MultiplayerState, PlayerAction } from "@/game/engine/multiplayer-rules";
import type { GameSettings } from "@/utils/settings-storage";
import type { MultiplayerPlayerOptions } from "@/multiplayer/player-options";
import { isRoomConnectionFailure, pollRoom, requestRoom } from "@/multiplayer/room-client";
import { describeRoomOperationFailure } from "@/multiplayer/multiplayer-errors";

type RoomResponse = {
  code: string;
  playerId: string;
  revision: number;
  deadlineAt: number | null;
  state: MultiplayerState | null;
  players: { id: string; health: number; ready: boolean }[];
  playerOptions: MultiplayerPlayerOptions;
  playerReady: boolean;
};

function samePlayers(left: RoomResponse["players"], right: RoomResponse["players"]) {
  return left.length === right.length && left.every((player, index) => {
    const other = right[index];
    return other !== undefined && player.id === other.id && player.health === other.health && player.ready === other.ready;
  });
}

function samePlayerOptions(left: MultiplayerPlayerOptions, right: MultiplayerPlayerOptions) {
  return left.difficulty === right.difficulty && left.handedness === right.handedness &&
    left.microgamesEnabled === right.microgamesEnabled && left.reducedMotion === right.reducedMotion;
}

export function useRunMultiplayerGame(settings: GameSettings) {
  const [role, setRole] = useState<"host" | "guest" | null>(null);
  const [playerId, setPlayerId] = useState("host");
  const [roomCode, setRoomCode] = useState("");
  const [state, setState] = useState<MultiplayerState | null>(null);
  const [incoming, setIncoming] = useState("");
  const [players, setPlayers] = useState<{ id: string; health: number; ready: boolean }[]>([]);
  const [playerReady, setPlayerReady] = useState(false);
  const [readyPlayers, setReadyPlayers] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [submitted, setSubmitted] = useState<number | null>(null);
  const [charged, setCharged] = useState(false);
  const [microgameScore, setMicrogameScore] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [disconnected, setDisconnected] = useState(false);
  const [playerOptions, setPlayerOptionsState] = useState<RoomResponse["playerOptions"]>({ difficulty: settings.difficulty, handedness: settings.handedness, microgamesEnabled: settings.microgamesEnabled, reducedMotion: settings.reducedMotion });
  const revision = useRef(-1);
  const deadlineAt = useRef<number | null>(null);
  const mounted = useRef(true);

  function updatePlayers(next: RoomResponse["players"]) {
    setPlayers(current => samePlayers(current, next) ? current : next);
    const nextReady = next.filter(candidate => candidate.ready).map(candidate => candidate.id);
    setReadyPlayers(current => current.length === nextReady.length && current.every((id, index) => id === nextReady[index]) ? current : nextReady);
  }

  function updatePlayerOptions(next: MultiplayerPlayerOptions) {
    setPlayerOptionsState(current => samePlayerOptions(current, next) ? current : next);
  }

  const logFailure = useCallback((operation: string, cause: unknown) => {
    const status = cause instanceof Error && "status" in cause && typeof cause.status === "number" ? cause.status : null;
    const details = JSON.stringify({
      event: "operation_failed", operation, roomCode: roomCode || null, playerId,
      role, revision: revision.current, turn: state?.turn ?? null,
      message: cause instanceof Error ? cause.message : String(cause),
      name: cause instanceof Error ? cause.name : typeof cause,
      status,
      at: new Date().toISOString(),
    });
    if (operation === "leave_room" || (operation === "poll" && status === 404)) console.warn("[multiplayer-client]", details);
    else console.error("[multiplayer-client]", details);
  }, [roomCode, playerId, role, state?.turn]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!roomCode || !playerId) return;
    let stopped = false;
    const update = async () => {
      try {
        const result = await pollRoom<RoomResponse>(roomCode, playerId);
        if (stopped) return;
        updatePlayers(result.players);
        deadlineAt.current = result.deadlineAt;
        setDisconnected(false);
        updatePlayerOptions(result.playerOptions);
        setPlayerReady(result.playerReady);
        if (result.revision !== revision.current) {
          revision.current = result.revision;
          if (result.state) {
            setState(result.state);
            setCharged(false);
            setSubmitted(null);
            setMicrogameScore(null);
          }
        }
      } catch (cause) {
        if (!stopped) {
          logFailure("poll", cause);
          setDisconnected(true);
          setError(describeRoomOperationFailure(cause, "poll"));
        }
      }
    };
    void update();
    const interval = setInterval(() => void update(), 400);
    return () => { stopped = true; clearInterval(interval); };
  }, [roomCode, playerId, logFailure]);

  useEffect(() => {
    const tick = () => setSeconds(deadlineAt.current ? Math.max(0, Math.ceil((deadlineAt.current - Date.now()) / 1000)) : 0);
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, []);

  async function run(operation: string, task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try { await task(); }
    catch (cause) { logFailure(operation, cause); setError(describeRoomOperationFailure(cause, operation)); }
    finally { if (mounted.current) setBusy(false); }
  }

  async function hostGame() {
    await run("host_room", async () => {
      const result = await requestRoom<RoomResponse>({
        type: "create", seed: settings.seed, difficulty: settings.difficulty,
        handedness: settings.handedness, microgamesEnabled: settings.microgamesEnabled, reducedMotion: settings.reducedMotion,
      });
      revision.current = result.revision;
      setRoomCode(result.code);
      setRole("host");
      setPlayerId(result.playerId);
      updatePlayers(result.players);
      setConnected(true);
      updatePlayerOptions(result.playerOptions);
      setPlayerReady(result.playerReady);
    });
  }

  async function join() {
    await run("join_room", async () => {
      const result = await requestRoom<RoomResponse>({ type: "join", code: incoming, ...playerOptions });
      revision.current = result.revision;
      setRoomCode(result.code);
      setRole("guest");
      setPlayerId(result.playerId);
      updatePlayers(result.players);
      updatePlayerOptions(result.playerOptions);
      setPlayerReady(result.playerReady);
      setConnected(true);
      setIncoming("");
    });
  }

  async function start() {
    if (!roomCode) return;
    await run("start_room", async () => {
      if (role === "guest") {
        const result = await requestRoom<RoomResponse>({ type: "ready", code: roomCode, playerId, ...playerOptions });
        revision.current = result.revision;
        updatePlayers(result.players);
        updatePlayerOptions(result.playerOptions);
        setPlayerReady(result.playerReady);
        return;
      }
      if (role === "host") {
        const configured = await requestRoom<RoomResponse>({
          type: "configure", code: roomCode, playerId,
          seed: settings.seed, difficulty: settings.difficulty,
          handedness: settings.handedness,
          microgamesEnabled: settings.microgamesEnabled,
          reducedMotion: settings.reducedMotion,
        });
        revision.current = configured.revision;
        updatePlayerOptions(configured.playerOptions);
      }
      const result = await requestRoom<RoomResponse>({ type: "start", code: roomCode, playerId });
      revision.current = result.revision;
      if (result.state) setState(result.state);
      updatePlayers(result.players);
      updatePlayerOptions(result.playerOptions);
      setPlayerReady(result.playerReady);
    });
  }

  async function setPlayerOptions(options: RoomResponse["playerOptions"]) {
    updatePlayerOptions(options);
    setPlayerReady(false);
    if (!roomCode) return;
    try {
      const result = await requestRoom<RoomResponse>({ type: "options", code: roomCode, playerId, ...options });
      revision.current = result.revision;
    } catch (cause) {
      logFailure("save_player_options", cause);
      setError(describeRoomOperationFailure(cause, "save_player_options"));
    }
  }

  async function submit(action: PlayerAction) {
    if (!state || state.ended || disconnected || submitted === state.turn) return;
    setSubmitted(state.turn);
    setError("");
    const complete = { ...action, charged, ...(microgameScore === null ? {} : { microgameScore }) };
    try {
      const result = await requestRoom<RoomResponse>({ type: "action", code: roomCode, playerId, turn: state.turn, action: complete });
      updatePlayers(result.players);
      deadlineAt.current = result.deadlineAt;
      if (result.state && result.revision !== revision.current) {
        revision.current = result.revision;
        setState(result.state);
        setSubmitted(null);
        setCharged(false);
        setMicrogameScore(null);
      }
    } catch (cause) {
      logFailure("submit_action", cause);
      setSubmitted(null);
      setError(describeRoomOperationFailure(cause, "submit_action"));
      if (isRoomConnectionFailure(cause)) setDisconnected(true);
    }
  }

  async function leave() {
    try {
      if (roomCode) await requestRoom({ type: "leave", code: roomCode, playerId });
    } catch (cause) {
      logFailure("leave_room", cause);
      // Always clear local room state even when the server has already lost or closed the room.
    } finally {
      setRoomCode("");
      setState(null);
      setPlayers([]);
      setReadyPlayers([]);
      setPlayerReady(false);
      setRole(null);
      setConnected(false);
      setDisconnected(false);
      setError("");
      setSubmitted(null);
      revision.current = -1;
    }
  }

  const view = useMemo(() => getMultiplayerPlayerView(state, playerId), [state, playerId]);
  const activePlayerOptions = view.player?.gameplayOptions ?? playerOptions;

  return {
    role,
    playerId,
    state,
    outgoing: roomCode,
    incoming,
    setIncoming,
    pendingId: "",
    ready: players.filter(candidate => candidate.id !== "host").map(candidate => candidate.id),
    readyPlayers,
    playerReady,
    lobbyPlayers: players.filter(candidate => candidate.id !== "host").map(candidate => candidate.id),
    error,
    busy,
    connected,
    submitted,
    charged,
    seconds,
    disconnected,
    player: view.player,
    map: view.map,
    snapshot: view.snapshot,
    hostGame: () => void hostGame(),
    start: () => void start(),
    submit: (action: PlayerAction) => void submit(action),
    playerOptions: activePlayerOptions,
    setPlayerOptions,
    removePlayer: () => undefined,
    chooseGuest: () => { setRole("guest"); setError(""); },
    addGuest: () => undefined,
    join: () => void join(),
    accept: () => undefined,
    cancelInvitation: () => undefined,
    leave: () => void leave(),
    toggleCharge: () => setCharged(value => !value),
    microgameScore,
    setMicrogameScore,
  };
}
