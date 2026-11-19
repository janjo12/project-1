import { randomBytes } from "node:crypto";

import { createMultiplayerState, resolveMultiplayerTurn, type MultiplayerState, type PlayerAction } from "@/game/engine/multiplayer-rules";
import { getTurnDuration } from "@/game/engine/resolveTurn";
import { getBotPlayerOptions, getMultiplayerBotActions, MAX_MULTIPLAYER_PLAYERS } from "@/game/engine/multiplayer-bot";
import { DEFAULT_MULTIPLAYER_PLAYER_OPTIONS, isMultiplayerPlayerOptionsPatch, multiplayerPlayerOptionsPatch, updateMultiplayerPlayerOptions, type MultiplayerPlayerOptions } from "@/multiplayer/player-options";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Session = {
  code: string;
  seed: string;
  playerIds: string[];
  playerOptions: Record<string, MultiplayerPlayerOptions>;
  botPlayerIds: Set<string>;
  readyPlayerIds: Set<string>;
  nextPlayerNumber: number;
  nextBotNumber: number;
  state: MultiplayerState | null;
  actions: Map<string, PlayerAction>;
  revision: number;
  timer: (ReturnType<typeof setTimeout> & { unref?: () => void }) | null;
  deadlineAt: number | null;
  touchedAt: number;
};

const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 1000;
const MAX_ACTIVE_ROOMS = readPositiveInteger(process.env.MULTIPLAYER_MAX_ACTIVE_ROOMS, 1_000, 10_000);
const globalSessions = globalThis as typeof globalThis & { __project1MultiplayerSessions?: Map<string, Session> };
const sessions = globalSessions.__project1MultiplayerSessions ??= new Map<string, Session>();
const globalCleanupClock = globalThis as typeof globalThis & { __project1MultiplayerLastCleanupAt?: number };
const roomAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function logRoomEvent(event: string, session: Pick<Session, "code" | "playerIds" | "state" | "revision" | "deadlineAt">, details: Record<string, unknown> = {}) {
  console.info("[multiplayer-room]", JSON.stringify({ event, roomCode: session.code, playerCount: session.playerIds.length, started: !!session.state, turn: session.state?.turn ?? null, revision: session.revision, deadlineAt: session.deadlineAt, at: new Date().toISOString(), ...details }));
}

function readPositiveInteger(value: string | undefined, fallback: number, maximum: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanExpiredSessions(force = false) {
  const now = Date.now();
  if (!force && now - (globalCleanupClock.__project1MultiplayerLastCleanupAt ?? 0) < CLEANUP_INTERVAL_MS) return;
  globalCleanupClock.__project1MultiplayerLastCleanupAt = now;
  for (const [code, session] of sessions) {
    if (now - session.touchedAt <= SESSION_TTL_MS) continue;
    logRoomEvent("expired", session, { idleMs: now - session.touchedAt });
    if (session.timer) clearTimeout(session.timer);
    sessions.delete(code);
  }
}

function newCode() {
  const maxUnbiasedByte = Math.floor(256 / roomAlphabet.length) * roomAlphabet.length;
  while (true) {
    let code = "";
    for (const byte of randomBytes(12)) {
      if (byte >= maxUnbiasedByte) continue;
      code += roomAlphabet[byte % roomAlphabet.length];
      if (code.length === 6) break;
    }
    if (code.length === 6 && !sessions.has(code)) return code;
  }
}

function publicSession(session: Session, playerId: string) {
  const personalOptions = session.playerOptions[playerId] ?? DEFAULT_MULTIPLAYER_PLAYER_OPTIONS;
  return {
    code: session.code,
    playerId,
    revision: session.revision,
    deadlineAt: personalOptions.difficulty === "hard" && !session.actions.has(playerId) ? session.deadlineAt : null,
    turnSubmitted: session.actions.has(playerId),
    state: session.state,
    playerOptions: session.playerOptions[playerId] ?? DEFAULT_MULTIPLAYER_PLAYER_OPTIONS,
    playerReady: session.readyPlayerIds.has(playerId),
    players: session.playerIds.map(id => ({ id, health: session.state?.players[id]?.health ?? 100, ready: session.readyPlayerIds.has(id) })),
  };
}

function eligiblePlayers(session: Session) {
  if (!session.state) return [];
  if (session.state.ended) return [];
  return [...session.playerIds];
}

function addBotTurnActions(session: Session) {
  if (!session.state) return;
  for (const [botId, action] of getMultiplayerBotActions(session.state, [...session.botPlayerIds], session.actions)) {
    if (!session.actions.has(botId)) session.actions.set(botId, action);
  }
}

function finishTurn(session: Session) {
  if (!session.state || session.state.ended) return;
  if (session.timer) clearTimeout(session.timer);
  session.timer = null;
  session.deadlineAt = null;
  addBotTurnActions(session);
  session.state = resolveMultiplayerTurn(session.state, new Map(session.actions));
  session.actions.clear();
  session.revision += 1;
  logRoomEvent("turn_finished", session);
  scheduleTurnDeadline(session);
}

function scheduleTurnDeadline(session: Session) {
  if (!session.state || session.state.ended || session.state.phase !== "playing") return;
  const hasUnsubmittedHardPlayer = session.playerIds.some(id =>
    !session.botPlayerIds.has(id) && session.playerOptions[id]?.difficulty === "hard" && !session.actions.has(id));
  if (!hasUnsubmittedHardPlayer) {
    if (session.timer) clearTimeout(session.timer);
    session.timer = null;
    session.deadlineAt = null;
    return;
  }
  if (session.timer) return;
  const duration = getTurnDuration({ difficulty: "hard", level: session.state.level });
  session.deadlineAt = Date.now() + duration;
  session.timer = setTimeout(() => {
    session.timer = null;
    session.deadlineAt = null;
    const timedOutPlayers = session.playerIds.filter(id =>
      !session.botPlayerIds.has(id) && session.playerOptions[id]?.difficulty === "hard" && !session.actions.has(id));
    for (const id of timedOutPlayers) session.actions.set(id, { type: "PASS" });
    const humanPlayers = eligiblePlayers(session).filter(id => !session.botPlayerIds.has(id));
    if (session.actions.size === humanPlayers.length) finishTurn(session);
    else {
      session.revision += 1;
      logRoomEvent("hard_actions_expired", session, { timedOutPlayers });
    }
  }, duration);
  logRoomEvent("turn_deadline_scheduled", session, { durationMs: duration });
  session.timer.unref?.();
}

function validAction(value: unknown): value is PlayerAction {
  if (!isRecord(value) || !["MOVE", "ATTACK", "SUPPORT", "CLASS_READY", "PICKUP", "PICKUP_EQUIPMENT", "DROP_EQUIPMENT", "DESCEND"].includes(String(value.type))) return false;
  return (value.target === undefined || typeof value.target === "string") &&
    (value.charged === undefined || typeof value.charged === "boolean") &&
    (value.microgameScore === undefined || (typeof value.microgameScore === "number" && Number.isFinite(value.microgameScore) && value.microgameScore >= 0));
}

function getSession(code: string) {
  const normalizedCode = code.trim().toUpperCase();
  const session = sessions.get(normalizedCode);
  if (session && Date.now() - session.touchedAt > SESSION_TTL_MS) {
    logRoomEvent("expired_on_access", session, { idleMs: Date.now() - session.touchedAt });
    if (session.timer) clearTimeout(session.timer);
    sessions.delete(normalizedCode);
    return undefined;
  }
  if (session) {
    session.touchedAt = Date.now();
    session.botPlayerIds ??= new Set();
    session.nextBotNumber ??= 1;
  }
  return session;
}

export async function GET(request: Request) {
  cleanExpiredSessions();
  const url = new URL(request.url);
  const session = getSession(url.searchParams.get("code") ?? "");
  const playerId = url.searchParams.get("playerId") ?? "";
  if (!session || !session.playerIds.includes(playerId)) return json({ error: "That room is closed or this player has left." }, 404);
  return json(publicSession(session, playerId));
}

export async function POST(request: Request) {
  cleanExpiredSessions();
  let body: unknown;
  try { body = await request.json(); }
  catch { return json({ error: "Send a valid JSON request." }, 400); }
  if (!isRecord(body) || typeof body.type !== "string") return json({ error: "Invalid multiplayer request." }, 400);

  if (body.type === "create") {
    const requestedSeed = body.seed;
    if (typeof requestedSeed !== "string") {
      return json({ error: "Choose a valid seed before hosting." }, 400);
    }
    if (sessions.size >= MAX_ACTIVE_ROOMS) {
      cleanExpiredSessions(true);
      if (sessions.size >= MAX_ACTIVE_ROOMS) return json({ error: "The multiplayer server is at room capacity. Try again shortly." }, 503);
    }
    const code = newCode();
    if (!isMultiplayerPlayerOptionsPatch(body)) return json({ error: "Choose valid personal gameplay options." }, 400);
    const hostOptions = updateMultiplayerPlayerOptions(DEFAULT_MULTIPLAYER_PLAYER_OPTIONS, multiplayerPlayerOptionsPatch(body));
    const session: Session = { code, seed: requestedSeed.trim() || "web-playtest", playerIds: ["host"], playerOptions: { host: hostOptions }, botPlayerIds: new Set(), readyPlayerIds: new Set(), nextPlayerNumber: 2, nextBotNumber: 1, state: null, actions: new Map(), revision: 0, timer: null, deadlineAt: null, touchedAt: Date.now() };
    sessions.set(code, session);
    logRoomEvent("created", session);
    return json(publicSession(session, "host"), 201);
  }

  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const session = getSession(code);
  if (!session) return json({ error: "That room code was not found. Check it and try again." }, 404);

  if (body.type === "add-bot") {
    const playerId = typeof body.playerId === "string" ? body.playerId : "";
    if (playerId !== "host") return json({ error: "Only the host can add a bot." }, 403);
    if (session.state) return json({ error: "Bots can only be added before the game starts." }, 409);
    if (session.playerIds.length >= MAX_MULTIPLAYER_PLAYERS) return json({ error: "This room already has the maximum of eight players." }, 409);
    const botId = `bot-${session.nextBotNumber++}`;
    session.playerIds.push(botId);
    session.botPlayerIds.add(botId);
    session.playerOptions[botId] = getBotPlayerOptions(session.playerOptions.host);
    session.readyPlayerIds.add(botId);
    session.revision += 1;
    logRoomEvent("bot_added", session, { botId });
    return json(publicSession(session, playerId), 201);
  }

  if (body.type === "join") {
    if (session.state) return json({ error: "This game has already started." }, 409);
    if (session.playerIds.length >= MAX_MULTIPLAYER_PLAYERS) return json({ error: "This room is full." }, 409);
    if (!isMultiplayerPlayerOptionsPatch(body)) return json({ error: "Choose valid personal gameplay options." }, 400);
    const playerId = `player-${session.nextPlayerNumber++}`;
    session.playerIds.push(playerId);
    session.playerOptions[playerId] = updateMultiplayerPlayerOptions(DEFAULT_MULTIPLAYER_PLAYER_OPTIONS, multiplayerPlayerOptionsPatch(body));
    session.revision += 1;
    logRoomEvent("joined", session, { playerId });
    return json(publicSession(session, playerId), 201);
  }

  const playerId = typeof body.playerId === "string" ? body.playerId : "";
  if (!session.playerIds.includes(playerId)) return json({ error: "This player is no longer in the room." }, 404);

  if (body.type === "configure") {
    const requestedSeed = body.seed;
    if (session.state) return json({ error: "This game has already started." }, 409);
    if (playerId !== "host" && body.seed !== undefined) {
      return json({ error: "Only the host can change the shared seed." }, 403);
    }
    if (body.seed !== undefined && typeof body.seed !== "string") {
      return json({ error: "Choose a valid seed before starting." }, 400);
    }
    if (!isMultiplayerPlayerOptionsPatch(body)) {
      return json({ error: "Choose valid personal gameplay options." }, 400);
    }
    session.playerOptions[playerId] = updateMultiplayerPlayerOptions(session.playerOptions[playerId], multiplayerPlayerOptionsPatch(body));
    if (requestedSeed !== undefined) session.seed = typeof requestedSeed === "string" ? requestedSeed.trim() || "web-playtest" : session.seed;
    for (const botId of session.botPlayerIds) {
      session.playerOptions[botId] = getBotPlayerOptions(session.playerOptions.host);
    }
    session.revision += 1;
    return json(publicSession(session, playerId));
  }

  if (body.type === "options") {
    if (session.state) return json({ error: "Gameplay options are locked after the game starts." }, 409);
    if (!isMultiplayerPlayerOptionsPatch(body)) return json({ error: "Choose valid personal gameplay options." }, 400);
    session.playerOptions[playerId] = updateMultiplayerPlayerOptions(session.playerOptions[playerId], multiplayerPlayerOptionsPatch(body));
    session.readyPlayerIds.delete(playerId);
    session.revision += 1;
    return json(publicSession(session, playerId));
  }

  if (body.type === "ready") {
    if (session.state) return json({ error: "This game has already started." }, 409);
    if (playerId === "host") return json({ error: "The host starts the room from the shared game options." }, 403);
    if (!isMultiplayerPlayerOptionsPatch(body)) return json({ error: "Choose valid personal gameplay options." }, 400);
    session.playerOptions[playerId] = updateMultiplayerPlayerOptions(session.playerOptions[playerId], multiplayerPlayerOptionsPatch(body));
    session.readyPlayerIds.add(playerId);
    session.revision += 1;
    logRoomEvent("player_ready", session, { playerId });
    return json(publicSession(session, playerId));
  }

  if (body.type === "start") {
    if (playerId !== "host") return json({ error: "Only the host can start the game." }, 403);
    if (session.state) return json({ error: "This game has already started." }, 409);
    if (session.playerIds.length < 2) return json({ error: "Add a bot or join from a second browser before starting." }, 409);
    if (session.playerIds.some(id => id !== "host" && !session.readyPlayerIds.has(id))) return json({ error: "Wait for every player to finish their own options and press Start." }, 409);
    session.state = createMultiplayerState(session.seed, "normal", [...session.playerIds]);
    for (const [id, options] of Object.entries(session.playerOptions)) {
      if (id in session.state.players) session.state.players[id].gameplayOptions = options;
    }
    logRoomEvent("started", session, { seed: session.seed });
    session.revision += 1;
    return json(publicSession(session, playerId));
  }

  if (body.type === "action") {
    if (session.botPlayerIds.has(playerId)) return json({ error: "Bots choose their own actions." }, 403);
    if (!session.state || session.state.ended) return json({ error: "The game is not accepting actions." }, 409);
    const turn = body.turn;
    if (!Number.isSafeInteger(turn) || turn !== session.state.turn || !validAction(body.action)) return json({ error: "That action is invalid or belongs to an earlier turn." }, 400);
    if (session.state.phase === "playing" && (session.state.players[playerId]?.health ?? 0) <= 0 && !["MOVE", "ATTACK", "SUPPORT"].includes(body.action.type)) {
      return json({ error: "Ghosts can only move, attack, or support." }, 403);
    }
    if (!eligiblePlayers(session).includes(playerId)) return json({ error: "This player cannot act during the current phase." }, 403);
    if (session.actions.has(playerId)) return json({ error: "You already submitted an action for this turn." }, 409);
    session.actions.set(playerId, body.action);
    scheduleTurnDeadline(session);
    const humanPlayers = eligiblePlayers(session).filter(id => !session.botPlayerIds.has(id));
    if (session.actions.size === humanPlayers.length) finishTurn(session);
    logRoomEvent("action_submitted", session, { playerId, actionType: body.action.type, pendingActions: session.actions.size });
    return json(publicSession(session, playerId));
  }

  if (body.type === "leave") {
    if (playerId === "host") {
      logRoomEvent("closed_by_host", session, { playerId });
      if (session.timer) clearTimeout(session.timer);
      session.timer = null;
      session.deadlineAt = null;
      sessions.delete(session.code);
      return json({ ok: true });
    }
    session.playerIds = session.playerIds.filter(id => id !== playerId);
    delete session.playerOptions[playerId];
    session.readyPlayerIds.delete(playerId);
    session.actions.delete(playerId);
    if (session.state) {
      const players = { ...session.state.players };
      delete players[playerId];
      session.state = { ...session.state, players };
      if (session.actions.size === eligiblePlayers(session).length) finishTurn(session);
      else scheduleTurnDeadline(session);
    }
    session.revision += 1;
    logRoomEvent("player_left", session, { playerId });
    return json({ ok: true });
  }

  return json({ error: "Unknown multiplayer request." }, 400);
}
