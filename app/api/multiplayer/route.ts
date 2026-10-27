import { randomBytes } from "node:crypto";

import { createMultiplayerState, resolveMultiplayerTurn, type MultiplayerState, type PlayerAction } from "@/game/engine/multiplayer-rules";
import { getTurnDuration } from "@/game/engine/resolveTurn";
import type { Difficulty } from "@/utils/settings-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Session = {
  code: string;
  seed: string;
  difficulty: Difficulty;
  playerIds: string[];
  nextPlayerNumber: number;
  state: MultiplayerState | null;
  actions: Map<string, PlayerAction>;
  revision: number;
  timer: ReturnType<typeof setTimeout> | null;
  deadlineAt: number | null;
  touchedAt: number;
};

const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 1000;
const MAX_ACTIVE_ROOMS = readPositiveInteger(process.env.MULTIPLAYER_MAX_ACTIVE_ROOMS, 1_000, 10_000);
const MAX_PLAYERS_PER_ROOM = 8;
const globalSessions = globalThis as typeof globalThis & { __project1MultiplayerSessions?: Map<string, Session> };
const sessions = globalSessions.__project1MultiplayerSessions ??= new Map<string, Session>();
const globalCleanupClock = globalThis as typeof globalThis & { __project1MultiplayerLastCleanupAt?: number };
const roomAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

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
  return {
    code: session.code,
    playerId,
    revision: session.revision,
    deadlineAt: session.deadlineAt,
    state: session.state,
    players: session.playerIds.map(id => ({ id, health: session.state?.players[id]?.health ?? 100 })),
  };
}

function eligiblePlayers(session: Session) {
  if (!session.state) return [];
  if (session.state.ended) return [];
  return [...session.playerIds];
}

function finishTurn(session: Session) {
  if (!session.state || session.state.ended) return;
  if (session.timer) clearTimeout(session.timer);
  session.timer = null;
  session.deadlineAt = null;
  session.state = resolveMultiplayerTurn(session.state, new Map(session.actions));
  session.actions.clear();
  session.revision += 1;
  scheduleTurnDeadline(session);
}

function scheduleTurnDeadline(session: Session) {
  if (!session.state || session.state.ended || session.state.phase !== "playing" || session.state.difficulty !== "hard") return;
  const duration = getTurnDuration({ difficulty: session.state.difficulty, level: session.state.level });
  session.deadlineAt = Date.now() + duration;
  session.timer = setTimeout(() => finishTurn(session), duration);
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
    if (session.timer) clearTimeout(session.timer);
    sessions.delete(normalizedCode);
    return undefined;
  }
  if (session) session.touchedAt = Date.now();
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
    const difficulty = body.difficulty;
    if (typeof body.seed !== "string" || !(difficulty === "easy" || difficulty === "normal" || difficulty === "hard")) {
      return json({ error: "Choose a valid seed and difficulty before hosting." }, 400);
    }
    if (sessions.size >= MAX_ACTIVE_ROOMS) {
      cleanExpiredSessions(true);
      if (sessions.size >= MAX_ACTIVE_ROOMS) return json({ error: "The multiplayer server is at room capacity. Try again shortly." }, 503);
    }
    const code = newCode();
    const session: Session = { code, seed: body.seed.trim() || "web-playtest", difficulty, playerIds: ["host"], nextPlayerNumber: 2, state: null, actions: new Map(), revision: 0, timer: null, deadlineAt: null, touchedAt: Date.now() };
    sessions.set(code, session);
    return json(publicSession(session, "host"), 201);
  }

  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const session = getSession(code);
  if (!session) return json({ error: "That room code was not found. Check it and try again." }, 404);

  if (body.type === "join") {
    if (session.state) return json({ error: "This game has already started." }, 409);
    if (session.playerIds.length >= MAX_PLAYERS_PER_ROOM) return json({ error: "This room is full." }, 409);
    const playerId = `player-${session.nextPlayerNumber++}`;
    session.playerIds.push(playerId);
    session.revision += 1;
    return json(publicSession(session, playerId), 201);
  }

  const playerId = typeof body.playerId === "string" ? body.playerId : "";
  if (!session.playerIds.includes(playerId)) return json({ error: "This player is no longer in the room." }, 404);

  if (body.type === "configure") {
    if (playerId !== "host") return json({ error: "Only the host can choose game options." }, 403);
    if (session.state) return json({ error: "This game has already started." }, 409);
    const difficulty = body.difficulty;
    if (typeof body.seed !== "string" || !(difficulty === "easy" || difficulty === "normal" || difficulty === "hard")) {
      return json({ error: "Choose a valid seed and difficulty before starting." }, 400);
    }
    session.seed = body.seed.trim() || "web-playtest";
    session.difficulty = difficulty;
    session.revision += 1;
    return json(publicSession(session, playerId));
  }

  if (body.type === "start") {
    if (playerId !== "host") return json({ error: "Only the host can start the game." }, 403);
    if (session.state) return json({ error: "This game has already started." }, 409);
    if (session.playerIds.length < 2) return json({ error: "Join from a second browser before starting the multiplayer playtest." }, 409);
    session.state = createMultiplayerState(session.seed, session.difficulty, [...session.playerIds]);
    session.revision += 1;
    return json(publicSession(session, playerId));
  }

  if (body.type === "action") {
    if (!session.state || session.state.ended) return json({ error: "The game is not accepting actions." }, 409);
    const turn = body.turn;
    if (!Number.isSafeInteger(turn) || turn !== session.state.turn || !validAction(body.action)) return json({ error: "That action is invalid or belongs to an earlier turn." }, 400);
    if ((session.state.players[playerId]?.health ?? 0) <= 0 && !["MOVE", "ATTACK", "SUPPORT"].includes(body.action.type)) {
      return json({ error: "Ghosts can only move, attack, or support." }, 403);
    }
    if (!eligiblePlayers(session).includes(playerId)) return json({ error: "This player cannot act during the current phase." }, 403);
    if (session.actions.has(playerId)) return json({ error: "You already submitted an action for this turn." }, 409);
    session.actions.set(playerId, body.action);
    if (session.actions.size === eligiblePlayers(session).length) finishTurn(session);
    return json(publicSession(session, playerId));
  }

  if (body.type === "leave") {
    if (session.timer) clearTimeout(session.timer);
    session.timer = null;
    session.deadlineAt = null;
    if (playerId === "host") {
      sessions.delete(session.code);
      return json({ ok: true });
    }
    session.playerIds = session.playerIds.filter(id => id !== playerId);
    session.actions.delete(playerId);
    if (session.state) {
      const players = { ...session.state.players };
      delete players[playerId];
      session.state = { ...session.state, players };
      if (session.actions.size === eligiblePlayers(session).length) finishTurn(session);
      else scheduleTurnDeadline(session);
    }
    session.revision += 1;
    return json({ ok: true });
  }

  return json({ error: "Unknown multiplayer request." }, 400);
}
