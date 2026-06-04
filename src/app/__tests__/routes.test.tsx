import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

import GameRoute from "@/app/game";
import GameOverRoute from "@/app/game-over";
import Index from "@/app/index";
import {
  DEFAULT_GAME_SETTINGS,
  GameSettings,
} from "@/utils/settings-storage";

const mockReplace = jest.fn();
const mockSaveSettings = jest.fn();
const mockUpdateSettings = jest.fn();

let mockedSettings: GameSettings = DEFAULT_GAME_SETTINGS;
let mockedIsLoading = false;
let mockedSearchParams: Record<string, string | undefined> = {};

jest.mock("expo-router", () => ({
  router: {
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

describe("routes", () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation();
    mockReplace.mockClear();
    mockSaveSettings.mockClear();
    mockUpdateSettings.mockClear();
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

  it("replaces the game route with game over when the player dies", () => {
    jest.useFakeTimers();
    const screen = render(<GameRoute />);

    for (let turn = 0; turn < 14; turn += 1) {
      fireEvent.press(screen.getByRole("button", { name: "Attack" }));
      act(() => {
        jest.advanceTimersByTime(1000);
      });
    }
    act(() => {
      jest.advanceTimersByTime(0);
    });

    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/game-over",
      params: { score: "4" },
    });

    jest.useRealTimers();
  });

  it("replaces the game route with the title route when quitting", () => {
    const screen = render(<GameRoute />);

    fireEvent.press(screen.getByRole("button", { name: "Quit to Title" }));

    expect(mockReplace).not.toHaveBeenCalled();

    const alertButtons = alertSpy.mock.calls[0][2];
    alertButtons[1].onPress();

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
