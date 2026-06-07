import * as Haptics from "expo-haptics";
import { act, fireEvent, render } from "@testing-library/react-native";
import { Alert, StyleSheet } from "react-native";

import { EndScreen } from "@/components/end-screen";
import { GameScreen, getSeededEnemyRoster } from "@/components/game-screen";
import { GameViewPanel } from "@/components/game-view-panel";
import { SettingsScreen } from "@/components/settings-screen";
import { SettingsForm } from "@/components/settings-form";
import { StartScreen } from "@/components/start-screen";
import { colors } from "@/components/theme";
import { DEFAULT_GAME_SETTINGS } from "@/utils/settings-storage";

const TEST_SEED = "test-88";
const TURN_DURATION = 4000;

function getBarFillWidth(screen: ReturnType<typeof render>, testID: string) {
  return parseFloat(
    StyleSheet.flatten(screen.getByTestId(`${testID}-fill`).props.style).width,
  );
}

function confirmAndResolveTurn(screen: ReturnType<typeof render>) {
  fireEvent.press(screen.getByTestId("action-confirmation-button"));

  act(() => {
    jest.advanceTimersByTime(1000);
  });
}

describe("game screens", () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation();
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it("starts from the title screen with editable settings", () => {
    const handleSettingsChange = jest.fn();
    const handleStartGame = jest.fn();
    const handleOpenSettings = jest.fn();

    const screen = render(
      <StartScreen
        isLoading={false}
        settings={DEFAULT_GAME_SETTINGS}
        onOpenSettings={handleOpenSettings}
        onSettingsChange={handleSettingsChange}
        onStartGame={handleStartGame}
      />,
    );

    fireEvent.changeText(screen.getByLabelText("Seed"), "starter-seed");
    fireEvent.press(screen.getByText("hard"));
    fireEvent.press(screen.getByText("left"));
    fireEvent.press(screen.getByRole("button", { name: "Settings" }));
    fireEvent.press(screen.getByRole("button", { name: "Start" }));

    expect(handleSettingsChange).toHaveBeenCalledWith({ seed: "starter-seed" });
    expect(handleSettingsChange).toHaveBeenCalledWith({ difficulty: "hard" });
    expect(handleSettingsChange).toHaveBeenCalledWith({ handedness: "left" });
    expect(handleOpenSettings).toHaveBeenCalledTimes(1);
    expect(handleStartGame).toHaveBeenCalledTimes(1);
  });

  it("mirrors the game controls for left-handed play", () => {
    const handleQuitToTitle = jest.fn();
    const { getByRole, getByTestId, rerender } = render(
      <GameScreen
        handedness="right"
        seed={TEST_SEED}
        onGameOver={jest.fn()}
        onQuitToTitle={handleQuitToTitle}
      />,
    );

    expect(
      StyleSheet.flatten(getByTestId("game-header").props.style)
        .justifyContent,
    ).toBe("flex-start");
    expect(
      StyleSheet.flatten(getByTestId("game-header").props.style).paddingTop,
    ).toBeGreaterThan(0);
    expect(
      StyleSheet.flatten(getByTestId("game-lower-layout").props.style)
        .flexDirection,
    ).toBe("row");
    expect(
      StyleSheet.flatten(getByTestId("game-lower-layout").props.style)
        .alignItems,
    ).toBe("flex-end");
    expect(getByTestId("dungeon-map-placeholder").children).toEqual([]);
    expect(
      getByTestId("action-button-cluster").children.map(
        (child) => child.props.testID,
      ),
    ).toEqual([
      "special-action-button",
      "defend-action-button",
      "attack-action-button",
    ]);
    expect(
      StyleSheet.flatten(getByTestId("special-action-button").props.style)
        .borderRadius,
    ).toBe(999);
    expect(
      StyleSheet.flatten(getByTestId("attack-action-button").props.style)
        .height,
    ).toBe(
      StyleSheet.flatten(getByTestId("attack-action-button").props.style).width,
    );
    expect(
      StyleSheet.flatten(
        getByTestId("direction-controls", {
          includeHiddenElements: true,
        }).props.style,
      ).opacity,
    ).toBe(0);
    expect(getByTestId("action-confirmation-button")).toHaveTextContent(
      "Select An Action",
    );

    fireEvent.press(getByRole("button", { name: "Quit to Title" }));

    expect(handleQuitToTitle).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      "Quit to Title?",
      "Your current run will be lost.",
      [
        { style: "cancel", text: "Cancel" },
        {
          onPress: handleQuitToTitle,
          style: "destructive",
          text: "Quit",
        },
      ],
    );

    const alertButtons = alertSpy.mock.calls[0][2];
    alertButtons[1].onPress();

    expect(handleQuitToTitle).toHaveBeenCalledTimes(1);

    rerender(
      <GameScreen handedness="left" seed={TEST_SEED} onGameOver={jest.fn()} />,
    );

    expect(
      StyleSheet.flatten(getByTestId("game-header").props.style)
        .justifyContent,
    ).toBe("flex-end");
    expect(
      StyleSheet.flatten(getByTestId("game-lower-layout").props.style)
        .flexDirection,
    ).toBe("row-reverse");
  });

  it("generates the same enemy order for the same seed", () => {
    const firstRoster = getSeededEnemyRoster("starter-seed").map(
      (enemy) => enemy.name,
    );
    const secondRoster = getSeededEnemyRoster("starter-seed").map(
      (enemy) => enemy.name,
    );
    const differentRoster = getSeededEnemyRoster("another-seed").map(
      (enemy) => enemy.name,
    );

    expect(secondRoster).toEqual(firstRoster);
    expect(differentRoster).not.toEqual(firstRoster);
  });

  it("shows emoji combatants, enemy roster, and vector status bars", () => {
    const screen = render(<GameViewPanel />);

    expect(screen.getByTestId("enemy-health-bar-icon").props.color).toBe(
      colors.health,
    );
    expect(getBarFillWidth(screen, "enemy-health-bar")).toBe(100);
    expect(screen.getByLabelText("Glitch Imp")).toHaveTextContent(
      "\uD83D\uDC7E",
    );
    expect(screen.getByLabelText("Player warrior")).toBeOnTheScreen();
  });

  it("selects an attack, confirms it early, and resolves player then enemy damage", () => {
    jest.useFakeTimers();

    const screen = render(
      <GameScreen
        handedness="right"
        seed={TEST_SEED}
        onGameOver={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByTestId("attack-action-button"));

    expect(screen.getByLabelText("Turn status")).toHaveTextContent(
      "Attack selected | Defeated 0",
    );
    expect(screen.getByText("Strike now. The enemy answers back.")).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId("action-confirmation-button"));

    expect(screen.getByLabelText("Turn status")).toHaveTextContent(
      "Resolving turn...",
    );

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(getBarFillWidth(screen, "enemy-health-bar")).toBeCloseTo(66.67, 1);
    expect(getBarFillWidth(screen, "player-health-bar")).toBe(90);
    expect(screen.getByTestId("enemy-health-loss")).toHaveTextContent("- 1");
    expect(screen.getByTestId("player-health-loss")).toHaveTextContent("- 1");
    expect(Haptics.impactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Medium,
    );
    expect(screen.getByLabelText("Turn status")).toHaveTextContent(
      "Facing Glitch Imp | Defeated 0",
    );

    jest.useRealTimers();
  });

  it("does not vibrate when vibration is disabled", () => {
    jest.useFakeTimers();

    const screen = render(
      <GameScreen
        handedness="right"
        seed={TEST_SEED}
        vibrationEnabled={false}
        onGameOver={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByTestId("attack-action-button"));
    confirmAndResolveTurn(screen);

    expect(Haptics.impactAsync).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it("defends against enemy damage for the turn", () => {
    jest.useFakeTimers();

    const screen = render(
      <GameScreen
        handedness="right"
        seed={TEST_SEED}
        onGameOver={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByTestId("defend-action-button"));
    confirmAndResolveTurn(screen);

    expect(getBarFillWidth(screen, "enemy-health-bar")).toBe(100);
    expect(getBarFillWidth(screen, "player-health-bar")).toBe(100);

    jest.useRealTimers();
  });

  it("defaults to defend when the turn timer runs out with no selected action", () => {
    jest.useFakeTimers();

    const screen = render(
      <GameScreen
        handedness="right"
        seed={TEST_SEED}
        onGameOver={jest.fn()}
      />,
    );

    expect(screen.getByTestId("action-confirmation-button")).toHaveTextContent(
      "Select An Action",
    );

    act(() => {
      jest.advanceTimersByTime(TURN_DURATION + 650);
    });

    expect(getBarFillWidth(screen, "enemy-health-bar")).toBe(100);
    expect(getBarFillWidth(screen, "player-health-bar")).toBe(100);

    jest.useRealTimers();
  });

  it("uses energy for a special attack that deals double damage", () => {
    jest.useFakeTimers();

    const screen = render(
      <GameScreen
        handedness="right"
        seed={TEST_SEED}
        onGameOver={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByTestId("special-action-button"));
    confirmAndResolveTurn(screen);

    expect(getBarFillWidth(screen, "enemy-health-bar")).toBeCloseTo(33.33, 1);
    expect(getBarFillWidth(screen, "player-energy-bar")).toBeCloseTo(83.33, 1);
    expect(getBarFillWidth(screen, "player-health-bar")).toBe(90);
    expect(screen.getByTestId("player-energy-loss")).toHaveTextContent("- 1");

    jest.useRealTimers();
  });

  it("advances through multiple emoji enemies", () => {
    jest.useFakeTimers();

    const screen = render(
      <GameScreen
        handedness="right"
        seed={TEST_SEED}
        onGameOver={jest.fn()}
      />,
    );

    expect(screen.getByLabelText("Glitch Imp roster enemy")).toBeOnTheScreen();
    expect(
      screen.getByLabelText("Crypt Stumbler roster enemy"),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText("Tiny Dragon roster enemy")).toBeOnTheScreen();
    expect(screen.getByLabelText("Night Count roster enemy")).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId("special-action-button"));
    confirmAndResolveTurn(screen);
    fireEvent.press(screen.getByTestId("attack-action-button"));
    confirmAndResolveTurn(screen);

    expect(screen.getByLabelText("Turn status")).toHaveTextContent(
      "Facing Crypt Stumbler | Defeated 1",
    );
    expect(getBarFillWidth(screen, "enemy-health-bar")).toBe(100);

    jest.useRealTimers();
  });

  it("cycles enemies indefinitely instead of ending after the roster", () => {
    jest.useFakeTimers();

    const screen = render(
      <GameScreen
        handedness="right"
        seed={TEST_SEED}
        onGameOver={jest.fn()}
      />,
    );

    for (let enemyNumber = 0; enemyNumber < 4; enemyNumber += 1) {
      fireEvent.press(screen.getByTestId("special-action-button"));
      confirmAndResolveTurn(screen);
      fireEvent.press(screen.getByTestId("attack-action-button"));
      confirmAndResolveTurn(screen);
    }

    expect(screen.getByLabelText("Turn status")).toHaveTextContent(
      "Facing Glitch Imp | Defeated 4",
    );
    expect(getBarFillWidth(screen, "enemy-health-bar")).toBe(100);

    jest.useRealTimers();
  });

  it("reports defeated enemies when the player dies", () => {
    jest.useFakeTimers();
    const handleGameOver = jest.fn();

    const screen = render(
      <GameScreen
        handedness="right"
        seed={TEST_SEED}
        onGameOver={handleGameOver}
      />,
    );

    for (let turn = 0; turn < 14; turn += 1) {
      fireEvent.press(screen.getByTestId("attack-action-button"));
      confirmAndResolveTurn(screen);
    }
    act(() => {
      jest.advanceTimersByTime(0);
    });

    expect(handleGameOver).toHaveBeenCalledWith(4);

    jest.useRealTimers();
  });

  it("returns to the title from the end screen", () => {
    const handleReturnToTitle = jest.fn();
    const screen = render(
      <EndScreen score="xx" onReturnToTitle={handleReturnToTitle} />,
    );

    expect(screen.getByText("Game")).toBeOnTheScreen();
    expect(screen.getByText("Over")).toBeOnTheScreen();
    expect(screen.getByText("Score: xx")).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "Return to Title" }));

    expect(handleReturnToTitle).toHaveBeenCalledTimes(1);
  });
});

describe("SettingsForm", () => {
  it("marks the selected game setup settings", () => {
    const screen = render(
      <SettingsForm
        settings={{
          appearance: "system",
          difficulty: "easy",
          handedness: "left",
          seed: "saved",
          vibrationEnabled: true,
        }}
        onChange={jest.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "easy" }).props.accessibilityState,
    ).toEqual(expect.objectContaining({ selected: true }));
    expect(
      screen.getByRole("radio", { name: "left" }).props.accessibilityState,
    ).toEqual(expect.objectContaining({ checked: true }));
    expect(screen.getByLabelText("Seed").props.placeholderTextColor).toBe(
      colors.fadedInk,
    );
    expect(screen.getByDisplayValue("saved")).toBeOnTheScreen();
  });
});

describe("SettingsScreen", () => {
  it("updates appearance and vibration preferences", () => {
    const handleSettingsChange = jest.fn();
    const handleReturnToTitle = jest.fn();
    const screen = render(
      <SettingsScreen
        settings={{
          appearance: "dark",
          difficulty: "easy",
          handedness: "left",
          seed: "saved",
          vibrationEnabled: true,
        }}
        onReturnToTitle={handleReturnToTitle}
        onSettingsChange={handleSettingsChange}
      />,
    );

    expect(screen.getByRole("switch", { name: "Dark Mode" }).props.value).toBe(
      true,
    );
    expect(screen.getByRole("switch", { name: "Vibration" }).props.value).toBe(
      true,
    );

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

    expect(handleSettingsChange).toHaveBeenCalledWith({ appearance: "light" });
    expect(handleSettingsChange).toHaveBeenCalledWith({
      vibrationEnabled: false,
    });
    expect(handleReturnToTitle).toHaveBeenCalledTimes(1);
  });
});
