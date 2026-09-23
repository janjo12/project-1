import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import Index from "@/app/index";
import Setup from "@/app/setup";

// Initial React Native modal rendering can be slow on the Windows test runner.
jest.setTimeout(30000);
let mockMode = "singleplayer";
jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn() }, useLocalSearchParams: () => ({ mode: mockMode }) }));
jest.mock("@/components/screen-shell", () => ({ ScreenShell: ({ children }: { children: React.ReactNode }) => children }));
jest.mock("@/hooks/use-game-settings", () => ({ useGameSettings: () => ({
  isLoading: false, settings: { appearance: "light", difficulty: "easy", seed: "test", vibrationEnabled: false },
  updateSettings: jest.fn(), saveSettings: jest.fn(async () => {}),
}) }));

beforeEach(() => jest.clearAllMocks());
test("choose a play mode before seeing seed and difficulty", () => {
  const screen = render(<Index />);
  expect(screen.queryByText("Difficulty")).toBeNull();
  fireEvent.press(screen.getByText("Singleplayer"));
  expect(router.push).toHaveBeenLastCalledWith({ pathname: "/setup", params: { mode: "singleplayer" } });
  fireEvent.press(screen.getByText("Multiplayer · Same Wi-Fi"));
  expect(router.push).toHaveBeenLastCalledWith({ pathname: "/setup", params: { mode: "multiplayer" } });
});
test.each(["singleplayer", "multiplayer"])("settings start the selected %s flow without handedness", async mode => {
  mockMode = mode;
  const screen = render(<Setup />);
  expect(screen.getByText("Difficulty")).toBeTruthy();
  expect(screen.queryByText("Handedness")).toBeNull();
  fireEvent.press(screen.getByText("Start"));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith(mode === "multiplayer" ? "/multiplayer" : "/game"));
});

