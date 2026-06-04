import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

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
  beforeEach(() => {
    mockReplace.mockClear();
    mockSaveSettings.mockClear();
    mockUpdateSettings.mockClear();
    mockedSettings = DEFAULT_GAME_SETTINGS;
    mockedIsLoading = false;
    mockedSearchParams = {};
  });

  it("saves settings and replaces the title route with the game route", async () => {
    mockSaveSettings.mockResolvedValue(undefined);
    const screen = render(<Index />);

    fireEvent.press(screen.getByRole("button", { name: "Start" }));

    await waitFor(() => {
      expect(mockSaveSettings).toHaveBeenCalledWith(DEFAULT_GAME_SETTINGS);
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

  it("replaces the end route with the title route", () => {
    mockedSearchParams = { score: "7" };
    const screen = render(<GameOverRoute />);

    expect(screen.getByText("Score: 7")).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "Return to Title" }));

    expect(mockReplace).toHaveBeenCalledWith("/");
  });
});
