import type { ReactElement } from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { router } from "expo-router";
import Index from "@/app/index";
import Setup from "@/app/setup";

// Initial React Native modal rendering can be slow on the Windows test runner.
jest.setTimeout(30000);
let mockMode = "singleplayer";
jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn() }, useLocalSearchParams: () => ({ mode: mockMode }) }));

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});
const renderWithSafeArea = (element: ReactElement) =>
  render(<SafeAreaProvider initialMetrics={{
    frame: { x: 0, y: 0, width: 400, height: 800 },
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  }}>{element}</SafeAreaProvider>);
test("choose a play mode before seeing seed and difficulty", async () => {
  const screen = renderWithSafeArea(<Index />);
  await waitFor(async () => {
    expect(await AsyncStorage.getItem("project-1:game-settings")).not.toBeNull();
  });
  expect(screen.queryByText("Difficulty")).toBeNull();
  fireEvent.press(screen.getByText("Singleplayer"));
  expect(router.push).toHaveBeenLastCalledWith({ pathname: "/setup", params: { mode: "singleplayer" } });
  fireEvent.press(screen.getByText("Multiplayer · Same Wi-Fi"));
  expect(router.push).toHaveBeenLastCalledWith({ pathname: "/setup", params: { mode: "multiplayer" } });
});
test.each(["singleplayer", "multiplayer"])("settings start the selected %s flow without handedness", async mode => {
  mockMode = mode;
  const screen = renderWithSafeArea(<Setup />);
  await screen.findByText("Difficulty");
  expect(screen.queryByText("Handedness")).toBeNull();
  fireEvent.press(screen.getByText("Start"));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith(mode === "multiplayer" ? "/multiplayer" : "/game"));
});
