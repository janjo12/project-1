import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import type { createClientConnection, createHostSession, GameState, PlayerAction } from "../../multiplayer/connection";
import { GAME_PARAMETERS } from "@/gameparameters";
import { getRunSnapshot, createLevelMap, getPlayerAttackDamage, resolveEnergyLoss, resolveHealthLoss, resolveTurnLoss, PLAYER_MAX_ENERGY, PLAYER_MAX_HEALTH } from "@/hooks/run-game-helpers";
import { getEnemyAttackOutcome, getHardTurnLimit, getTurnDuration, hasTurnLimit } from "@/hooks/run-game-policies";
import type { Direction, DungeonMap } from "@/utils/dungeon-map";
import { addItemToRoom, damageMonsterInRoom, getConnectedRoomId, getRoom, getRoomItem, getRoomMonster, getTargetableMonsters, hasRoomStairs, moveCurrentPosition, unlockDoor } from "@/utils/dungeon-map-runtime";
import type { Difficulty, GameSettings } from "@/utils/settings-storage";

export type MultiplayerPlayer = { id: string; roomId: string; health: number; energy: number; item: string | null };
export type MultiplayerState = GameState & {
  version: 1; seed: string; difficulty: Difficulty; level: number; map: DungeonMap;
  players: Record<string, MultiplayerPlayer>; turnsLeft: number; ended: boolean;
};
export function createMultiplayerState(seed: string, difficulty: Difficulty, ids: string[]): MultiplayerState {
  const map = createLevelMap(seed, 1, undefined, difficulty !== "easy");
  return { version: 1, turn: 0, seed, difficulty, level: 1, map, ended: false,
    turnsLeft: getHardTurnLimit({ difficulty, map }),
    players: Object.fromEntries(ids.map(id => [id, { id, roomId: map.startingRoomId, health: PLAYER_MAX_HEALTH, energy: PLAYER_MAX_ENERGY, item: null }])) };
}

/** Stable player order makes contested items/attacks independent of packet arrival order. */
export function resolveMultiplayerTurn(previous: MultiplayerState, actions: ReadonlyMap<string, PlayerAction>): MultiplayerState {
  const state: MultiplayerState = { ...previous, turn: previous.turn + 1,
    players: Object.fromEntries(Object.entries(previous.players).map(([id, player]) => [id, { ...player }])) };
  if (state.ended) return state;
  for (const player of Object.values(state.players)) {
    if (player.health <= 0) continue;
    const action = actions.get(player.id) ?? { type: "DEFEND" };
    const charged = !!action.charged && player.energy >= GAME_PARAMETERS.combat.chargeEnergyCost;
    if (charged) {
      const result = resolveEnergyLoss(player.energy, GAME_PARAMETERS.combat.chargeEnergyCost, player.item);
      player.energy = result.nextEnergy;
      if (result.usesMeal) player.item = null;
    }
    const room = getRoom(state.map, player.roomId);
    if (action.type === "MOVE" && ["north", "east", "south", "west"].includes(action.target ?? "")) {
      const direction = action.target as Direction;
      if (room?.[direction] === "locked" && player.item === "key") {
        state.map = unlockDoor(state.map, player.roomId, direction);
        player.item = null;
      }
      const destination = getConnectedRoomId(state.map, player.roomId, direction);
      if (destination) {
        player.roomId = destination;
        state.map = moveCurrentPosition(state.map, destination);
        continue;
      }
    }
    if (action.type === "ATTACK") {
      const monster = getTargetableMonsters(state.map, room).find(m => m.id === action.target);
      if (monster) {
        const silver = monster.chases && player.item === "silver-bullet";
        state.map = damageMonsterInRoom(state.map, player.roomId, monster.id,
          silver ? monster.currentHealth : getPlayerAttackDamage(monster, charged));
        if (silver) player.item = null;
      }
    }
    if (action.type === "PICKUP") {
      const item = getRoomItem(state.map, room);
      if (item) {
        // Remove the instance ID, not the item's kind (there can be several of a kind).
        state.map = { ...state.map, rooms: state.map.rooms.map(row => row.map(r => r.id === player.roomId
          ? { ...r, contents: r.contents.filter(c => !(c.type === "item" && c.id === item.id)) } : r)) };
        if (player.item) state.map = addItemToRoom(state.map, player.roomId, player.item);
        player.item = item.itemId ?? item.id;
      }
    }
    const enemy = getRoomMonster(state.map, getRoom(state.map, player.roomId));
    if (enemy) {
      const defending = action.type === "DEFEND";
      const outcome = getEnemyAttackOutcome({ isDefending: defending, monsterDamage: enemy.damage });
      const health = resolveHealthLoss(player.health, defending && charged ? 0 : outcome.damageTaken, player.item);
      player.health = health.nextHealth;
      if (health.usesPotion) player.item = null;
      if (defending) state.map = damageMonsterInRoom(state.map, player.roomId, enemy.id,
        charged ? GAME_PARAMETERS.combat.chargedCounterattackDamage : outcome.counterattackDamage);
    }
  }
  const alive = Object.values(state.players).filter(p => p.health > 0);
  // Everyone alive must reach the stairs; one player then chooses Descend.
  if (alive.length && alive.every(p => hasRoomStairs(getRoom(state.map, p.roomId))) &&
      alive.some(p => actions.get(p.id)?.type === "DESCEND")) {
    state.level++;
    state.map = createLevelMap(state.seed, state.level, undefined, state.difficulty !== "easy");
    state.turnsLeft = getHardTurnLimit({ difficulty: state.difficulty, map: state.map });
    for (const player of Object.values(state.players)) {
      player.roomId = state.map.startingRoomId; player.health = PLAYER_MAX_HEALTH; player.energy = PLAYER_MAX_ENERGY;
    }
  } else if (hasTurnLimit(state.difficulty)) {
    const clockOwner = alive.find(p => p.item === "clock");
    const result = resolveTurnLoss(state.turnsLeft, clockOwner?.item ?? null, state.level);
    state.turnsLeft = result.nextCounter;
    if (result.usesClock && clockOwner) clockOwner.item = null;
  }
  state.ended = alive.length === 0 || (hasTurnLimit(state.difficulty) && state.turnsLeft <= 0);
  return state;
}

export function isMultiplayerState(value: GameState): value is MultiplayerState {
  const state = value as MultiplayerState;
  return state.version === 1 && typeof state.seed === "string" && ["easy", "normal", "hard"].includes(state.difficulty) &&
    Number.isInteger(state.level) && state.level > 0 && typeof state.ended === "boolean" && Number.isFinite(state.turnsLeft) &&
    !!state.map && Array.isArray(state.map.rooms) && !!state.map.entities && !!state.players &&
    Object.values(state.players).every(p => typeof p.id === "string" && typeof p.roomId === "string" &&
      Number.isFinite(p.health) && Number.isFinite(p.energy));
}

type Host = ReturnType<typeof createHostSession<MultiplayerState>>;
type Client = Awaited<ReturnType<typeof createClientConnection>>;
// Load native WebRTC only when hosting/joining, so singleplayer still works in Expo Go.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Native module must load inside the recoverable host/join action.
const networking = () => require("../../multiplayer/connection") as typeof import("../../multiplayer/connection");


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
  const [lobbyPlayers, setLobbyPlayers] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [submitted, setSubmitted] = useState<number | null>(null);
  const [charged, setCharged] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [disconnected, setDisconnected] = useState(false);
  const [foreground, setForeground] = useState(true);
  const report = (e: unknown) => { if (mounted.current) setError(e instanceof Error ? e.message : String(e)); };
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
    if (!state || state.ended || role !== "host" || state.difficulty !== "hard" || !foreground) return;
    const duration = getTurnDuration({ difficulty: state.difficulty, level: state.level });
    const deadline = Date.now() + duration;

    const tick = setInterval(() => setSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000))), 250);
    const timeout = setTimeout(() => { try { host.current?.finishTurn(); } catch (e) { report(e); } }, duration);
    return () => { clearInterval(tick); clearTimeout(timeout); };
  }, [state, role, foreground]);

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
        hostPlayerId: "host", initialState: createMultiplayerState(settings.seed, settings.difficulty, ["host"]),
        connectionOptions: { configuration: { iceServers: [] } },
        resolveTurn: (previous, actions) => {
          const ids = new Set(["host", ...(host.current?.readyPlayerIds ?? [])]);
          const players = Object.fromEntries(Object.entries(previous.players).filter(([id]) => ids.has(id)));
          return resolveMultiplayerTurn({ ...previous, players }, actions);
        },
        isActivePlayer: (current, id) => !current.ended && (current.players[id]?.health ?? 0) > 0,
        onState: receive, onError: report,
        onPlayersChange: () => {
          if (mounted.current) {
            setReady(host.current?.readyPlayerIds ?? []);
            setLobbyPlayers(host.current?.playerIds ?? []);
          }
        },
      });
      setRole("host");
    } catch { setError("Multiplayer needs the installed native development build. Expo Go does not include WebRTC."); }
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
      configuration: { iceServers: [] }, onError: report,
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
      if (!ready.length) throw new Error("Connect at least one other device first.");
      host.current!.start(createMultiplayerState(settings.seed, settings.difficulty, ["host", ...ready]));
    } catch (e) { report(e); }
  }
  function submit(action: PlayerAction) {
    if (!state || state.ended || disconnected || submitted === state.turn) return;
    setSubmitted(state.turn); setError("");
    try {
      const complete = { ...action, charged };
      if (host.current) {
        if (!host.current.submitHostAction(state.turn, complete)) setSubmitted(null);
      } else client.current!.send({ type: "SUBMIT_ACTION", turn: state.turn, action: complete });
    } catch (e) { setSubmitted(null); report(e); }
  }

  const player = state?.players[playerId];
  const map = state && player ? moveCurrentPosition(state.map, player.roomId) : null;
  const snapshot = state && player && map ? getRunSnapshot({ activeMonsterId: null, clearedLevels: state.level - 1,
    difficulty: state.difficulty, dungeonMap: map, inventoryItem: player.item, isResolving: false, level: state.level,
    playerEnergy: player.energy, playerHealth: player.health, turnCounter: state.turnsLeft }) : null;
  function removePlayer(id: string) {
    host.current?.removePlayer(id);
    if (id === pendingId) { setPendingId(""); setOutgoing(""); }
  }
  return {
    role, playerId, state, outgoing, incoming, setIncoming, pendingId, ready,
    lobbyPlayers, error, busy, connected, submitted, charged, seconds, disconnected,
    player, map, snapshot, hostGame, start, submit, removePlayer,
    chooseGuest: () => setRole("guest"),
    addGuest: () => run(addGuest),
    join: () => run(join),
    accept: () => run(accept),
    cancelInvitation: () => removePlayer(pendingId),
    toggleCharge: () => setCharged(value => !value),
  };
}
