import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { MultiplayerScreen } from "@/components/Common/MultiplayerScreen";
import { useRunMultiplayerGame } from "@/game/engine/run-game-multiplayer";
import { createMultiplayerState } from "@/game/engine/multiplayer-rules";
import { DEFAULT_GAME_SETTINGS } from "@/utils/settings-storage";

jest.mock("@/game/engine/run-game-multiplayer", () => ({ useRunMultiplayerGame: jest.fn() }));

test("an ended multiplayer run shows Game Over and leaves no frozen gameplay controls", async () => {
  const state = createMultiplayerState("ended-screen", "normal", ["host"]);
  state.phase = "playing";
  state.ended = true;
  state.players.host.health = 0;
  const player = state.players.host;
  const onLeave = jest.fn();
  (useRunMultiplayerGame as jest.Mock).mockReturnValue({
    role: "host",
    playerId: "host",
    state,
    outgoing: "",
    incoming: "",
    setIncoming: jest.fn(),
    pendingId: "",
    ready: [],
    botIds: [],
    lobbyPlayers: [],
    readyPlayers: [],
    playerReady: false,
    error: "",
    busy: false,
    connected: true,
    submitted: null,
    charged: false,
    seconds: 0,
    disconnected: false,
    player,
    map: state.map,
    snapshot: { roomSceneActors: [] },
    hostGame: jest.fn(),
    addBot: jest.fn(),
    start: jest.fn(),
    submit: jest.fn(),
    removePlayer: jest.fn(),
    chooseGuest: jest.fn(),
    addGuest: jest.fn(),
    join: jest.fn(),
    accept: jest.fn(),
    cancelInvitation: jest.fn(),
    leave: jest.fn(),
    toggleCharge: jest.fn(),
    playerOptions: player.gameplayOptions ?? { ...DEFAULT_GAME_SETTINGS, difficulty: "normal" },
    setPlayerOptions: jest.fn(),
  });

  const screen = await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 400, height: 800 }, insets: { top: 0, right: 0, bottom: 0, left: 0 } }}>
      <MultiplayerScreen settings={DEFAULT_GAME_SETTINGS} onLeave={onLeave} onHostSelect={jest.fn()} />
    </SafeAreaProvider>,
  );

  expect(screen.getByText("Game Over")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /doorway/i })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Return to Title" }));
  expect(onLeave).toHaveBeenCalledTimes(1);
});
