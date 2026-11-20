import { getConnectedRoomId, getRoom, getRoomEquipmentById, getRoomItemById, getTargetableMonsters, hasRoomStairs } from "@/game/dungeon/rooms";
import type { Direction } from "@/game/dungeon/types";
import type { MultiplayerState, PlayerAction } from "@/game/engine/multiplayer-rules";
import type { MultiplayerPlayerOptions } from "@/multiplayer/player-options";

export const MAX_MULTIPLAYER_PLAYERS = 8;
const DIRECTIONS: Direction[] = ["north", "east", "south", "west"];

export function isBotPlayerId(playerId: string) {
  return /^bot-\d+$/.test(playerId);
}

export function getBotPlayerName(playerId: string) {
  const number = playerId.match(/^bot-(\d+)$/)?.[1];
  return number ? `Bot ${number}` : playerId;
}

export function getBotPlayerOptions(hostOptions: MultiplayerPlayerOptions, difficulty = hostOptions.difficulty): MultiplayerPlayerOptions {
  return { ...hostOptions, difficulty, microgamesEnabled: false };
}

export function getMultiplayerBotActions(
  state: MultiplayerState,
  botIds: readonly string[],
  submittedActions: ReadonlyMap<string, PlayerAction> = new Map(),
) {
  const actions = new Map<string, PlayerAction>();
  for (const botId of botIds) {
    if (!state.players[botId]) continue;
    actions.set(botId, getMultiplayerBotAction(state, botId, submittedActions));
  }
  return actions;
}

export function getMultiplayerBotAction(
  state: MultiplayerState,
  botId: string,
  submittedActions: ReadonlyMap<string, PlayerAction> = new Map(),
): PlayerAction {
  if (state.phase === "briefing") return { type: "CLASS_READY" };
  const bot = state.players[botId];
  if (!bot) return { type: "SUPPORT", target: "host" };

  const perfectDefense = { defenseScore: 100 };
  if (bot.health <= 0) return { type: "SUPPORT", target: "host", ...perfectDefense };

  const room = getRoom(state.map, bot.roomId);
  const host = state.players.host;
  const hostAction = submittedActions.get("host");

  // Stay with the host when they choose a doorway; when grouped, help defeat the same target.
  if (host && bot.roomId === host.roomId && hostAction?.type === "MOVE" && isDirection(hostAction.target)) {
    if (room[hostAction.target] === "open" || (room[hostAction.target] === "locked" && canOpenLockedDoor(bot))) {
      return { type: "MOVE", target: hostAction.target, ...perfectDefense };
    }
  }
  const monsters = getTargetableMonsters(state.map, room);
  const hostTarget = hostAction?.type === "ATTACK" ? hostAction.target : undefined;
  const monster = monsters.find(candidate => candidate.id === hostTarget) ?? monsters[0];
  if (monster) return { type: "ATTACK", target: monster.id, microgameScore: 100, ...perfectDefense };

  const livingPlayers = Object.values(state.players).filter(player => player.health > 0);
  if (hasRoomStairs(room) && livingPlayers.every(player => hasRoomStairs(getRoom(state.map, player.roomId)))) {
    return { type: "DESCEND", ...perfectDefense };
  }

  if (hostAction?.type === "MOVE" && host && bot.roomId === host.roomId && isDirection(hostAction.target)) {
    return { type: "MOVE", target: hostAction.target, ...perfectDefense };
  }

  const itemReference = room.contents.find((content): content is Extract<typeof content, { type: "item" }> => content.type === "item");
  if (!bot.item && itemReference && getRoomItemById(state.map, room, itemReference.id)) {
    return { type: "PICKUP", target: itemReference.id, ...perfectDefense };
  }
  const equipmentReference = room.contents.find((content): content is Extract<typeof content, { type: "equipment" }> => content.type === "equipment");
  if (!bot.equipment && equipmentReference && getRoomEquipmentById(state.map, room, equipmentReference.id)) {
    return { type: "PICKUP_EQUIPMENT", target: equipmentReference.id, ...perfectDefense };
  }

  const hostDestination = host && hostAction?.type === "MOVE" && isDirection(hostAction.target)
    ? getConnectedRoomId(state.map, host.roomId, hostAction.target)
    : host?.roomId;
  if (hostDestination && hostDestination !== bot.roomId) {
    const direction = getNextOpenDirection(state, bot.roomId, hostDestination);
    if (direction) return { type: "MOVE", target: direction, ...perfectDefense };
  }

  const unexploredDirection = DIRECTIONS.find(direction => {
    const nextRoomId = getConnectedRoomId(state.map, bot.roomId, direction);
    if (!nextRoomId) return false;
    return !getRoom(state.map, nextRoomId).isRevealed;
  });
  if (unexploredDirection) return { type: "MOVE", target: unexploredDirection, ...perfectDefense };

  const openDirection = DIRECTIONS.find(direction => getConnectedRoomId(state.map, bot.roomId, direction));
  if (openDirection) return { type: "MOVE", target: openDirection, ...perfectDefense };
  return { type: "SUPPORT", target: host?.id ?? bot.id, ...perfectDefense };
}

function getNextOpenDirection(state: MultiplayerState, fromRoomId: string, targetRoomId: string): Direction | null {
  const queue: { roomId: string; firstDirection: Direction | null }[] = [{ roomId: fromRoomId, firstDirection: null }];
  const visited = new Set([fromRoomId]);
  while (queue.length) {
    const current = queue.shift()!;
    const room = getRoom(state.map, current.roomId);
    for (const direction of DIRECTIONS) {
      const nextRoomId = getConnectedRoomId(state.map, room.id, direction);
      if (!nextRoomId || visited.has(nextRoomId)) continue;
      const firstDirection = current.firstDirection ?? direction;
      if (nextRoomId === targetRoomId) return firstDirection;
      visited.add(nextRoomId);
      queue.push({ roomId: nextRoomId, firstDirection });
    }
  }
  return null;
}

function canOpenLockedDoor(bot: MultiplayerState["players"][string]) {
  return bot.item === "key" || bot.classId === "thief";
}

function isDirection(value: string | undefined): value is Direction {
  return value === "north" || value === "east" || value === "south" || value === "west";
}
