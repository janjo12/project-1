import { getBotPlayerOptions, getMultiplayerBotAction, getMultiplayerBotActions, getBotPlayerName, isBotPlayerId } from "@/game/engine/multiplayer-bot";
import { createMultiplayerState } from "@/game/engine/multiplayer-rules";

test("bots inherit host preferences while keeping microgames disabled", () => {
  const hostOptions = { difficulty: "hard" as const, handedness: "left" as const, microgamesEnabled: true, reducedMotion: true };
  expect(getBotPlayerOptions(hostOptions)).toEqual({ ...hostOptions, microgamesEnabled: false });
  expect(isBotPlayerId("bot-2")).toBe(true);
  expect(isBotPlayerId("player-2")).toBe(false);
  expect(getBotPlayerName("bot-2")).toBe("Bot 2");
});

test("bots mark themselves ready during the class briefing", () => {
  const state = createMultiplayerState("testbot", "normal", ["host", "bot-1"]);
  expect(getMultiplayerBotAction(state, "bot-1")).toEqual({ type: "CLASS_READY" });
});

test("bots attack with perfect attack and defense scores and follow the host through a doorway", () => {
  const state = createMultiplayerState("testbot", "normal", ["host", "bot-1"]);
  state.phase = "playing";
  const bot = state.players["bot-1"];
  const room = state.map.rooms.flat().find(candidate => candidate.id === bot.roomId)!;
  const monsterId = "bot-test-monster";
  state.map.entities.monsters[monsterId] = {
    id: monsterId,
    name: "Training Dummy",
    type: "monster",
    currentHealth: 30,
    maximumHealth: 30,
    attack: 0,
    damage: 0,
    defense: 0,
    sprite: "pixel_golem_graphic",
  };
  room.contents.push({ type: "monster", id: monsterId });

  expect(getMultiplayerBotAction(state, "bot-1")).toMatchObject({
    type: "ATTACK",
    target: monsterId,
    microgameScore: 100,
    defenseScore: 100,
  });

  room.contents = room.contents.filter(content => content.type !== "monster");
  delete state.map.entities.monsters[monsterId];
  const direction = (["north", "east", "south", "west"] as const).find(value => room[value] === "open");
  expect(direction).toBeDefined();
  const move = new Map([["host", { type: "MOVE" as const, target: direction }]]);
  expect(getMultiplayerBotActions(state, ["bot-1"], move).get("bot-1")).toMatchObject({
    type: "MOVE",
    target: direction,
    defenseScore: 100,
  });
});
