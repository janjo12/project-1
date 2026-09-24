import { createMultiplayerState, resolveMultiplayerTurn } from "@/hooks/run-game-multiplayer";
import { PLAYER_MAX_ENERGY, PLAYER_MAX_HEALTH } from "@/hooks/run-game-helpers";
import type { PlayerAction } from "../multiplayer/connection";
import { getConnectedRoomId, getRoom } from "@/utils/dungeon-map-runtime";
import type { Direction } from "@/utils/dungeon-map";

const initial = () => { const state = createMultiplayerState("lan-test", "easy", ["host", "guest"]); state.phase = "playing"; return state; };
test("two devices have independent positions in the same authoritative map", () => {
  const state = initial();
  const player = state.players.host;
  const direction = (["north", "east", "south", "west"] as Direction[]).find(d => getConnectedRoomId(state.map, player.roomId, d));
  expect(direction).toBeDefined();
  const next = resolveMultiplayerTurn(state, new Map([["host", { type: "MOVE", target: direction }]]));
  expect(next.players.host.roomId).not.toBe(state.players.host.roomId);
  expect(next.players.guest.roomId).toBe(state.players.guest.roomId);
  expect(state.turn).toBe(0);
  expect(next.turn).toBe(1);
});

test("charged movement refunds energy and still consumes the shared turn", () => {
  const state = initial();
  state.difficulty = "normal";
  state.turnsLeft = 12;
  const player = state.players.host;
  const direction = (["north", "east", "south", "west"] as Direction[]).find(d => getConnectedRoomId(state.map, player.roomId, d));
  expect(direction).toBeDefined();

  const next = resolveMultiplayerTurn(state, new Map([[
    "host",
    { type: "MOVE", target: direction, charged: true },
  ]]));

  expect(next.players.host.energy).toBe(player.energy);
  expect(next.players.host.roomId).not.toBe(player.roomId);
  expect(next.turn).toBe(state.turn + 1);
  expect(next.turnsLeft).toBe(11);
});

test("a shared item can only be picked up once regardless of packet order", () => {
  const state = initial();
  const room = getRoom(state.map, state.players.host.roomId)!;
  room.contents = [{ type: "item", id: "unique-potion" }];
  state.map.entities.items["unique-potion"] = { id: "unique-potion", itemId: "health-potion", label: "Potion", type: "item" };
  const actions: [string, PlayerAction][] = [["guest", { type: "PICKUP" }], ["host", { type: "PICKUP" }]];
  const next = resolveMultiplayerTurn(state, new Map(actions));
  expect(next.players.host.item).toBe("health-potion");
  expect(next.players.guest.item).toBeNull();
  expect(resolveMultiplayerTurn(state, new Map(actions.reverse()))).toEqual(next);
});

test("remote attacks cannot target monsters outside the player's room", () => {
  const state = initial();
  const room = getRoom(state.map, state.players.host.roomId)!;
  room.contents = [];
  state.map.entities.doorwayGuards = {};
  state.map.entities.monsters.remote = { id: "remote", type: "monster", name: "Remote", sprite: "x", damage: 1, currentHealth: 9, maximumHealth: 9 };
  const next = resolveMultiplayerTurn(state, new Map([["host", { type: "ATTACK", target: "remote" }]]));
  expect(next.map.entities.monsters.remote.currentHealth).toBe(9);
});

test("team descends together and revives fallen teammates", () => {
  const state = initial();
  getRoom(state.map, state.players.host.roomId)!.contents = [{ type: "stairs", id: "stairs" }];
  state.map.entities.doorwayGuards = {};
  state.players.guest.health = 0;
  const next = resolveMultiplayerTurn(state, new Map([["host", { type: "DESCEND" }]]));
  expect(next.level).toBe(2);
  expect(next.players.guest.health).toBeGreaterThan(0);
  expect(next.players.guest.roomId).toBe(next.players.host.roomId);
});

test("turn limits end the shared run", () => {
  const state = initial();
  state.difficulty = "normal";
  state.turnsLeft = 1;
  expect(resolveMultiplayerTurn(state, new Map()).ended).toBe(true);
});

test("the shared game stays in briefing until every player completes class instructions", () => {
  const state = createMultiplayerState("briefing", "easy", ["host", "guest"]);
  const oneReady = resolveMultiplayerTurn(state, new Map([["host", { type: "CLASS_READY" }]]));
  expect(oneReady.phase).toBe("briefing");
  const allReady = resolveMultiplayerTurn(oneReady, new Map([["guest", { type: "CLASS_READY" }]]));
  expect(allReady.phase).toBe("playing");
});

test("warrior support redirects an ally's hit and resolves before player order", () => {
  const state = initial();
  state.players.host.classId = "cleric";
  state.players.guest.classId = "warrior";
  const room = getRoom(state.map, state.players.host.roomId)!;
  room.contents = [{ type: "monster", id: "guard" }];
  state.map.entities.monsters.guard = { id: "guard", type: "monster", name: "Guard", sprite: "g", damage: 40, currentHealth: 100, maximumHealth: 100 };
  const next = resolveMultiplayerTurn(state, new Map([
    ["host", { type: "DEFEND" }],
    ["guest", { type: "SUPPORT", target: "host", charged: true }],
  ]));
  expect(next.players.host.health).toBe(PLAYER_MAX_HEALTH);
  expect(next.players.guest.health).toBeLessThan(PLAYER_MAX_HEALTH);
  expect(next.players.guest.energy).toBe(PLAYER_MAX_ENERGY - 10);
  expect(next.map.entities.monsters.guard.currentHealth).toBeLessThan(100);
  const reversedActions = new Map<string, PlayerAction>([
    ["guest", { type: "SUPPORT", target: "host", charged: true }],
    ["host", { type: "DEFEND" }],
  ]);
  expect(resolveMultiplayerTurn(state, reversedActions)).toEqual(next);
});
