import { createMultiplayerState, resolveMultiplayerTurn } from "@/game/engine/run-game-multiplayer";
import { getConnectedRoomId } from "@/game/dungeon/rooms";
import type { Direction } from "@/game/dungeon/types";

test("multiplayer movement keeps each player independent and always spends the team turn", () => {
  const state = createMultiplayerState("lan-test", "normal", ["host", "guest"]);
  state.phase = "playing";
  const host = state.players.host;
  const direction = (["north", "east", "south", "west"] as Direction[]).find(value => getConnectedRoomId(state.map, host.roomId, value));
  expect(direction).toBeDefined();
  const next = resolveMultiplayerTurn(state, new Map([["host", { type: "MOVE", target: direction, charged: true }]]));
  expect(next.players.host.roomId).not.toBe(host.roomId);
  expect(next.players.guest.roomId).toBe(state.players.guest.roomId);
  expect(next.turn).toBe(state.turn + 1);
  expect(next.players.host.energy).toBe(host.energy);
});
