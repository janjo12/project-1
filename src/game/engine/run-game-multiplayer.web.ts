import { useEffect, useRef, useState } from "react";

import { getEquipmentStats } from "@/game/actions/items";
import { getRunSnapshot } from "@/game/engine/run-game-snapshot";
import { moveCurrentPosition } from "@/game/dungeon/rooms";
import type { MultiplayerState, PlayerAction } from "@/game/engine/multiplayer-rules";
import type { GameSettings } from "@/utils/settings-storage";

type RoomResponse = {
  code: string;
  playerId: string;
  revision: number;
  deadlineAt: number | null;
  state: MultiplayerState | null;
  players: Array<{ id: string; health: number }>;
};

type RoomRequestError = Error & { status: number };

function isRoomConnectionFailure(cause: unknown) {
  if (cause instanceof TypeError) return true;
  return cause instanceof Error && "status" in cause &&
    typeof cause.status === "number" && (cause.status === 404 || cause.status >= 500);
}

async function requestRoom<T extends object>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/multiplayer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json() as T | { error?: string };
  if (!response.ok) {
    const error = new Error("error" in result && result.error ? result.error : `Multiplayer request failed (${response.status}).`) as RoomRequestError;
    error.status = response.status;
    throw error;
  }
  return result as T;
}

async function pollRoom(code: string, playerId: string) {
  const query = new URLSearchParams({ code, playerId });
  const response = await fetch(`/api/multiplayer?${query}`, { cache: "no-store" });
  const result = await response.json() as RoomResponse | { error?: string };
  if (!response.ok) throw new Error("error" in result && result.error ? result.error : `Room update failed (${response.status}).`);
  return result as RoomResponse;
}

export function useRunMultiplayerGame(settings: GameSettings) {
  const [role, setRole] = useState<"host" | "guest" | null>(null);
  const [playerId, setPlayerId] = useState("host");
  const [roomCode, setRoomCode] = useState("");
  const [state, setState] = useState<MultiplayerState | null>(null);
  const [incoming, setIncoming] = useState("");
  const [players, setPlayers] = useState<Array<{ id: string; health: number }>>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [submitted, setSubmitted] = useState<number | null>(null);
  const [charged, setCharged] = useState(false);
  const [microgameScore, setMicrogameScore] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [disconnected, setDisconnected] = useState(false);
  const revision = useRef(-1);
  const deadlineAt = useRef<number | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!roomCode || !playerId) return;
    let stopped = false;
    const update = async () => {
      try {
        const result = await pollRoom(roomCode, playerId);
        if (stopped) return;
        setPlayers(result.players);
        deadlineAt.current = result.deadlineAt;
        setDisconnected(false);
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
          setDisconnected(true);
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      }
    };
    void update();
    const interval = setInterval(() => void update(), 400);
    return () => { stopped = true; clearInterval(interval); };
  }, [roomCode, playerId]);

  useEffect(() => {
    const tick = () => setSeconds(deadlineAt.current ? Math.max(0, Math.ceil((deadlineAt.current - Date.now()) / 1000)) : 0);
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, []);

  async function run(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try { await task(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { if (mounted.current) setBusy(false); }
  }

  async function hostGame() {
    await run(async () => {
      const result = await requestRoom<RoomResponse>({ type: "create", seed: settings.seed, difficulty: settings.difficulty });
      revision.current = result.revision;
      setRoomCode(result.code);
      setRole("host");
      setPlayerId(result.playerId);
      setPlayers(result.players);
      setConnected(true);
    });
  }

  async function join() {
    await run(async () => {
      const result = await requestRoom<RoomResponse>({ type: "join", code: incoming });
      revision.current = result.revision;
      setRoomCode(result.code);
      setRole("guest");
      setPlayerId(result.playerId);
      setPlayers(result.players);
      setConnected(true);
      setIncoming("");
    });
  }

  async function start() {
    if (!roomCode) return;
    await run(async () => {
      const configured = await requestRoom<RoomResponse>({ type: "configure", code: roomCode, playerId, seed: settings.seed, difficulty: settings.difficulty });
      revision.current = configured.revision;
      const result = await requestRoom<RoomResponse>({ type: "start", code: roomCode, playerId });
      revision.current = result.revision;
      if (result.state) setState(result.state);
      setPlayers(result.players);
    });
  }

  async function submit(action: PlayerAction) {
    if (!state || state.ended || disconnected || submitted === state.turn) return;
    setSubmitted(state.turn);
    setError("");
    const complete = { ...action, charged, ...(microgameScore === null ? {} : { microgameScore }) };
    try {
      const result = await requestRoom<RoomResponse>({ type: "action", code: roomCode, playerId, turn: state.turn, action: complete });
      setPlayers(result.players);
      deadlineAt.current = result.deadlineAt;
      if (result.state && result.revision !== revision.current) {
        revision.current = result.revision;
        setState(result.state);
        setSubmitted(null);
        setCharged(false);
        setMicrogameScore(null);
      }
    } catch (cause) {
      setSubmitted(null);
      setError(cause instanceof Error ? cause.message : String(cause));
      if (isRoomConnectionFailure(cause)) setDisconnected(true);
    }
  }

  async function leave() {
    try {
      if (roomCode) await requestRoom({ type: "leave", code: roomCode, playerId });
    } catch {
      // Always clear local room state even when the server has already lost or closed the room.
    } finally {
      setRoomCode("");
      setState(null);
      setPlayers([]);
      setRole(null);
      setConnected(false);
      setDisconnected(false);
      setError("");
      setSubmitted(null);
      revision.current = -1;
    }
  }

  const player = state?.players[playerId];
  const map = state && player ? moveCurrentPosition(state.map, player.roomId) : null;
  const snapshot = state && player && map ? getRunSnapshot({
    activeMonsterId: null,
    clearedLevels: state.level - 1,
    difficulty: state.difficulty,
    dungeonMap: map,
    inventoryItem: player.item,
    equipment: player.equipment ?? null,
    isResolving: false,
    level: state.level,
    playerEnergy: player.energy,
    playerHealth: player.health,
    turnCounter: state.turnsLeft,
  }) : null;

  return {
    role,
    playerId,
    state,
    outgoing: roomCode,
    incoming,
    setIncoming,
    pendingId: "",
    ready: players.filter(candidate => candidate.id !== "host").map(candidate => candidate.id),
    lobbyPlayers: players.filter(candidate => candidate.id !== "host").map(candidate => candidate.id),
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
    hostGame: () => void hostGame(),
    start: () => void start(),
    submit: (action: PlayerAction) => void submit(action),
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
