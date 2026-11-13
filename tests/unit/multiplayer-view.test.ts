import { createMultiplayerState } from "@/game/engine/multiplayer-rules";
import { getMultiplayerPlayerView } from "@/game/engine/multiplayer-view";

test("the shared multiplayer view derives the local actor and scene from its room", () => {
  const state = createMultiplayerState("testwizard", "normal", ["host", "guest"]);
  state.phase = "playing";
  const targetRoomId = state.map.rooms.flat().find(room => room.id !== state.map.startingRoomId)!.id;
  state.players.guest.roomId = targetRoomId;

  const view = getMultiplayerPlayerView(state, "guest");

  expect(view.player).toBe(state.players.guest);
  expect(view.snapshot?.currentRoomId).toBe(targetRoomId);
  expect(view.snapshot?.roomDoorways).toBeDefined();
});

test("the shared multiplayer view returns an empty view for a player absent from the state", () => {
  const state = createMultiplayerState("testwizard", "normal", ["host"]);
  expect(getMultiplayerPlayerView(state, "missing")).toEqual({ player: undefined, map: null, snapshot: null });
  expect(getMultiplayerPlayerView(null, "host")).toEqual({ player: undefined, map: null, snapshot: null });
});
