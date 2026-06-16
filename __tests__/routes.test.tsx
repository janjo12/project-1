import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

import GameRoute from "@/app/game";
import GameOverRoute from "@/app/game-over";
import Index from "@/app/index";
import SettingsRoute from "@/app/settings";
import {
  DEFAULT_GAME_SETTINGS,
  GameSettings,
} from "@/utils/settings-storage";

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockSaveSettings = jest.fn();
const mockUpdateSettings = jest.fn();
const mockGameScreenProps = jest.fn();

let mockedSettings: GameSettings = DEFAULT_GAME_SETTINGS;
let mockedIsLoading = false;
let mockedSearchParams: Record<string, string | undefined> = {};

jest.mock("expo-router", () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
  useLocalSearchParams: () => mockedSearchParams,
}));

jest.mock("@/hooks/use-game-settings", () => ({
  useGameSettings: () => ({
    isLoading: mockedIsLoading,
    settings: mockedSettings,
    saveSettings: mockSaveSettings,
    updateSettings: mockUpdateSettings,
  }),
}));

jest.mock("@/components/game-screen", () => ({
  GameScreen: (props: {
    difficulty?: string;
    onGameOver: (score: number) => void;
    onQuitToTitle?: () => void;
  }) => {
    const { Pressable, Text } = require("react-native");
    const { onGameOver, onQuitToTitle } = props;

    mockGameScreenProps(props);

    return (
      <>
        <Pressable
          accessibilityRole="button"
          onPress={() => onGameOver(1)}
          testID="mock-game-over-button"
        >
          <Text>End Run</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onQuitToTitle}>
          <Text>Quit to Title</Text>
        </Pressable>
      </>
    );
  },
}));

describe("routes", () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation();
    mockPush.mockClear();
    mockReplace.mockClear();
    mockSaveSettings.mockClear();
    mockUpdateSettings.mockClear();
    mockGameScreenProps.mockClear();
    mockedSettings = DEFAULT_GAME_SETTINGS;
    mockedIsLoading = false;
    mockedSearchParams = {};
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it("saves settings and replaces the title route with the game route", async () => {
    mockSaveSettings.mockResolvedValue(undefined);
    const screen = render(<Index />);

    fireEvent.press(screen.getByRole("button", { name: "Start" }));

    await waitFor(() => {
      expect(mockSaveSettings).toHaveBeenCalledWith({
        ...DEFAULT_GAME_SETTINGS,
        seed: expect.any(String),
      });
      expect(mockReplace).toHaveBeenCalledWith("/game");
    });

    expect(mockSaveSettings.mock.calls[0][0].seed).not.toBe("");
  });

  it("keeps a user-provided seed when starting the game", async () => {
    mockedSettings = { ...DEFAULT_GAME_SETTINGS, seed: "starter-seed" };
    mockSaveSettings.mockResolvedValue(undefined);
    const screen = render(<Index />);

    fireEvent.press(screen.getByRole("button", { name: "Start" }));

    await waitFor(() => {
      expect(mockSaveSettings).toHaveBeenCalledWith(mockedSettings);
      expect(mockReplace).toHaveBeenCalledWith("/game");
    });
  });

  it("pushes the settings route from the title screen", () => {
    const screen = render(<Index />);

    fireEvent.press(screen.getByRole("button", { name: "Settings" }));

    expect(mockPush).toHaveBeenCalledWith("/settings");
  });

  it("updates preferences from the settings route", () => {
    mockedSettings = {
      ...DEFAULT_GAME_SETTINGS,
      appearance: "dark",
      vibrationEnabled: true,
    };
    const screen = render(<SettingsRoute />);

    fireEvent(
      screen.getByRole("switch", { name: "Dark Mode" }),
      "valueChange",
      false,
    );
    fireEvent(
      screen.getByRole("switch", { name: "Vibration" }),
      "valueChange",
      false,
    );
    fireEvent.press(screen.getByRole("button", { name: "Back to Title" }));

    expect(mockUpdateSettings).toHaveBeenCalledWith({ appearance: "light" });
    expect(mockUpdateSettings).toHaveBeenCalledWith({
      vibrationEnabled: false,
    });
    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it("replaces the game route with game over when the player dies", () => {
    mockedSettings = { ...DEFAULT_GAME_SETTINGS, difficulty: "hard" };
    const screen = render(<GameRoute />);

    expect(mockGameScreenProps).toHaveBeenCalledWith(
      expect.objectContaining({ difficulty: "hard" }),
    );

    fireEvent.press(screen.getByTestId("mock-game-over-button"));

    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/game-over",
      params: { score: "1" },
    });
  });

  it("replaces the game route with the title route when quitting", () => {
    const screen = render(<GameRoute />);

    fireEvent.press(screen.getByRole("button", { name: "Quit to Title" }));

    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it("creates a new seed before replacing the end route with the title route", async () => {
    mockedSearchParams = { score: "7" };
    mockedSettings = { ...DEFAULT_GAME_SETTINGS, seed: "finished-run" };
    mockSaveSettings.mockResolvedValue(undefined);
    const screen = render(<GameOverRoute />);

    expect(screen.getByText("Score: 7")).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "Return to Title" }));

    await waitFor(() => {
      expect(mockSaveSettings).toHaveBeenCalledWith({
        ...mockedSettings,
        seed: expect.any(String),
      });
      expect(mockReplace).toHaveBeenCalledWith("/");
    });
    expect(mockSaveSettings.mock.calls[0][0].seed).not.toBe("finished-run");
  });
});
