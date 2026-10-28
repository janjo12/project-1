import { createMultiplayerState, resolveMultiplayerTurn } from "@/game/engine/run-game-multiplayer";
import { PLAYER_MAX_ENERGY, PLAYER_MAX_HEALTH } from "@/game/engine/run-game-helpers";
import type { PlayerAction } from "@/multiplayer/connection";
import { addEquipmentToRoom, getConnectedRoomId, getRoom } from "@/game/dungeon/rooms";
import type { Direction, RoomEquipmentRef } from "@/game/dungeon/types";
import { getMultiplayerPlayerAuraColor, getMultiplayerRoomActors } from "@/game/engine/multiplayer-presentation";
import { getGameClass } from "@/game/config/game-classes";
import { GAME_PARAMETERS } from "@/game/config/gameparameters";

const initial = () => { const state = createMultiplayerState("lan-test", "easy", ["host", "guest"]); state.phase = "playing"; return state; };
test("same-class allies appear as tappable room actors with distinct stable auras", () => {
  const state = initial();
  state.players.guest.classId = state.players.host.classId;
  const actors = getMultiplayerRoomActors([], Object.values(state.players), state.players.host.roomId, "host");

  expect(actors).toHaveLength(1);
  expect(actors[0]).toMatchObject({
    id: "guest",
    kind: "player",
    sprite: getGameClass(state.players.guest.classId).sprite,
    auraColor: expect.any(String),
  });
  expect(getMultiplayerPlayerAuraColor(Object.keys(state.players), "host"))
    .not.toBe(actors[0].auraColor);
  expect(getMultiplayerRoomActors([], Object.values(state.players), "another-room", "host")).toHaveLength(0);
});

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

test("multiplayer chests reveal loot when the matching slot is occupied and the next click swaps it", () => {
  const state = initial();
  const room = getRoom(state.map, state.players.host.roomId)!;
  state.players.host.equipment = "good-weapon";
  state.map = addEquipmentToRoom(state.map, room.id, "heavy-armor");
  const chest = getRoom(state.map, room.id)!.contents.find(content => content.type === "equipment");
  expect(chest?.type).toBe("equipment");
  if (chest?.type !== "equipment") throw new Error("Expected a generated equipment chest.");

  const opened = resolveMultiplayerTurn(state, new Map([["host", { type: "PICKUP_EQUIPMENT", target: chest.id }]]));
  expect(opened.players.host.equipment).toBe("good-weapon");
  expect(getRoom(opened.map, room.id)!.contents.find((content): content is RoomEquipmentRef => content.type === "equipment" && content.id === chest.id)?.isChest).toBe(false);

  const swapped = resolveMultiplayerTurn(opened, new Map([["host", { type: "PICKUP_EQUIPMENT", target: chest.id }]]));
  expect(swapped.players.host.equipment).toBe("heavy-armor");
  expect(getRoom(swapped.map, room.id)!.contents.some(content => content.type === "equipment" && content.isChest === false)).toBe(true);
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

test("multiplayer ordinary and charged attacks cannot damage a Werewolf", () => {
  const state = initial();
  const room = getRoom(state.map, state.players.host.roomId)!;
  room.contents = [{ type: "monster", id: "werewolf" }];
  state.map.entities.monsters.werewolf = {
    id: "werewolf", type: "monster", name: "Werewolf", sprite: "w", chases: true,
    damage: 19, currentHealth: 60, maximumHealth: 60,
  };

  const next = resolveMultiplayerTurn(state, new Map([["host", {
    type: "ATTACK", target: "werewolf", charged: true, microgameScore: 80,
  }]]));

  expect(next.map.entities.monsters.werewolf.currentHealth).toBe(60);

  const uncharged = resolveMultiplayerTurn(next, new Map([[
    "host",
    { type: "ATTACK", target: "werewolf", charged: false, microgameScore: 100 },
  ]]));
  expect(uncharged.map.entities.monsters.werewolf.currentHealth).toBe(60);
});

test("Wizard Chain Lightning damages every other enemy for half the actual target damage", () => {
  const state = initial();
  state.players.host.classId = "wizard";
  const room = getRoom(state.map, state.players.host.roomId)!;
  room.contents = [{ type: "monster", id: "primary" }, { type: "monster", id: "secondary" }];
  state.map.entities.monsters.primary = { id: "primary", type: "monster", name: "Primary", sprite: "x", damage: 0, currentHealth: 30, maximumHealth: 30 };
  state.map.entities.monsters.secondary = { id: "secondary", type: "monster", name: "Secondary", sprite: "x", damage: 0, currentHealth: 30, maximumHealth: 30 };

  const next = resolveMultiplayerTurn(state, new Map([["host", { type: "ATTACK", target: "primary", microgameScore: 100 }]]));

  expect(next.map.entities.monsters.primary.currentHealth).toBe(17);
  expect(next.map.entities.monsters.secondary.currentHealth).toBe(24);
});

test("Wizard Empower Attacks gives an ally two stronger turns and improves further when charged", () => {
  const state = initial();
  state.players.host.classId = "wizard";
  state.players.guest.classId = "cleric";
  const room = getRoom(state.map, state.players.host.roomId)!;
  room.contents = [{ type: "monster", id: "target" }];
  state.map.entities.monsters.target = { id: "target", type: "monster", name: "Target", sprite: "x", damage: 0, currentHealth: 100, maximumHealth: 100 };

  const next = resolveMultiplayerTurn(state, new Map([
    ["host", { type: "SUPPORT", target: "guest", charged: true }],
    ["guest", { type: "ATTACK", target: "target", microgameScore: 100 }],
  ]));

  expect(next.map.entities.monsters.target.currentHealth).toBe(80);
  expect(next.players.guest.empoweredAttackBonus).toBe(10);
  expect(next.players.guest.empoweredAttackTurns).toBe(2);
});

test("multiplayer Silver Arrow kills the Werewolf without needing attack damage", () => {
  const state = initial();
  const room = getRoom(state.map, state.players.host.roomId)!;
  room.contents = [{ type: "monster", id: "werewolf" }];
  state.players.host.item = "silver-bullet";
  state.map.entities.monsters.werewolf = {
    id: "werewolf", type: "monster", name: "Werewolf", sprite: "w", chases: true,
    damage: 19, currentHealth: 1, maximumHealth: 1,
  };

  const next = resolveMultiplayerTurn(state, new Map([["host", {
    type: "ATTACK", target: "werewolf",
  }]]));

  expect(next.map.entities.monsters.werewolf.currentHealth).toBe(0);
  expect(next.players.host.item).toBeNull();
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
    ["host", { type: "SUPPORT" }],
    ["guest", { type: "SUPPORT", target: "host", charged: true }],
  ]));
  expect(next.players.host.health).toBe(PLAYER_MAX_HEALTH);
  expect(next.players.guest.health).toBeLessThan(PLAYER_MAX_HEALTH);
  expect(next.players.guest.energy).toBe(PLAYER_MAX_ENERGY - 10);
  expect(next.map.entities.monsters.guard.currentHealth).toBeLessThan(100);
  const reversedActions = new Map<string, PlayerAction>([
    ["guest", { type: "SUPPORT", target: "host", charged: true }],
    ["host", { type: "SUPPORT" }],
  ]);
  expect(resolveMultiplayerTurn(state, reversedActions)).toEqual(next);
});

test("charged Warrior support adds five defense and deals only a small riposte in multiplayer", () => {
  const state = initial();
  state.difficulty = "hard";
  state.players.host.classId = "warrior";
  const room = getRoom(state.map, state.players.host.roomId)!;
  room.contents = [{ type: "monster", id: "guard" }];
  state.map.entities.monsters.guard = { id: "guard", type: "monster", name: "Guard", sprite: "g", damage: 24, currentHealth: 100, maximumHealth: 100 };

  const next = resolveMultiplayerTurn(state, new Map([["host", { type: "SUPPORT", charged: true, defenseScore: 0 }]]));

  expect(next.players.host.health).toBe(PLAYER_MAX_HEALTH - 4);
  expect(next.players.host.defenseBuff).toBe(0);
  expect(next.map.entities.monsters.guard.currentHealth).toBe(100 - GAME_PARAMETERS.combat.warriorRiposteDamage);
  expect(GAME_PARAMETERS.combat.warriorRiposteDamage).toBeLessThan(GAME_PARAMETERS.combat.normalAttackDamage);
  expect(next.players.host.energy).toBe(PLAYER_MAX_ENERGY - 10);
});

test("Cleric support adds five defense for two multiplayer turns", () => {
  const state = initial();
  state.difficulty = "hard";
  state.players.host.classId = "cleric";
  const room = getRoom(state.map, state.players.host.roomId)!;
  room.contents = [{ type: "monster", id: "guard" }];
  state.map.entities.monsters.guard = { id: "guard", type: "monster", name: "Guard", sprite: "g", damage: 20, currentHealth: 100, maximumHealth: 100 };

  const first = resolveMultiplayerTurn(state, new Map([["host", { type: "SUPPORT", defenseScore: 0 }]]));
  expect(first.players.host.health).toBe(PLAYER_MAX_HEALTH - 5);
  expect(first.players.host.defenseBuff).toBe(5);
  expect(first.players.host.defenseBuffTurns).toBe(1);

  const second = resolveMultiplayerTurn(first, new Map());
  expect(second.players.host.health).toBe(PLAYER_MAX_HEALTH - 10);
  expect(second.players.host.defenseBuff).toBe(0);
  expect(second.players.host.defenseBuffTurns).toBe(0);
});

test("Miracle saves a Cleric once per level at half Health without spending Energy", () => {
  const state = initial();
  state.difficulty = "hard";
  const cleric = state.players.host;
  cleric.classId = "cleric";
  state.players.guest.roomId = "B5";
  const room = getRoom(state.map, cleric.roomId)!;
  room.contents = [{ type: "monster", id: "guard" }];
  state.map.entities.monsters.guard = {
    id: "guard", type: "monster", name: "Guard", sprite: "g",
    damage: 200, currentHealth: 100, maximumHealth: 100,
  };

  const saved = resolveMultiplayerTurn(state, new Map([[
    "host", { type: "SUPPORT", defenseScore: 0 },
  ]]));
  expect(saved.players.host.health).toBe(Math.ceil(PLAYER_MAX_HEALTH / 2));
  expect(saved.players.host.energy).toBe(PLAYER_MAX_ENERGY);
  expect(saved.players.host.miracleUsed).toBe(true);

  saved.players.host.health = 5;
  const fallen = resolveMultiplayerTurn(saved, new Map([[
    "host", { type: "SUPPORT" },
  ]]));
  expect(fallen.players.host.health).toBeLessThanOrEqual(0);
  expect(fallen.players.host.energy).toBe(PLAYER_MAX_ENERGY);
});

test("Miracle becomes available again when the party descends to a new level", () => {
  const state = initial();
  const room = getRoom(state.map, state.players.host.roomId)!;
  room.contents = [{ type: "stairs", id: "stairs" }];
  state.map.entities.doorwayGuards = {};
  for (const player of Object.values(state.players)) {
    player.roomId = state.players.host.roomId;
    player.classId = "cleric";
    player.miracleUsed = true;
  }

  const next = resolveMultiplayerTurn(state, new Map([[
    "host", { type: "DESCEND" },
  ]]));

  expect(next.level).toBe(2);
  expect(Object.values(next.players).every(player => player.miracleUsed === false)).toBe(true);
});

test("missing multiplayer actions do not block enemy damage or counterattack", () => {
  const state = initial();
  const room = getRoom(state.map, state.players.host.roomId)!;
  room.contents = [{ type: "monster", id: "guard" }];
  state.map.entities.monsters.guard = { id: "guard", type: "monster", name: "Guard", sprite: "g", damage: 20, currentHealth: 100, maximumHealth: 100 };
  const next = resolveMultiplayerTurn(state, new Map());
  expect(next.players.host.health).toBeLessThan(PLAYER_MAX_HEALTH);
  expect(next.players.guest.health).toBeLessThan(PLAYER_MAX_HEALTH);
  expect(next.map.entities.monsters.guard.currentHealth).toBe(100);
});
