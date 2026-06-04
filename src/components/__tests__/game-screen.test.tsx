import * as Haptics from "expo-haptics";
import { act, fireEvent, render } from "@testing-library/react-native";
import { Alert, StyleSheet } from "react-native";

import { EndScreen } from "@/components/end-screen";
import { GameScreen, getSeededEnemyRoster } from "@/components/game-screen";
import { GameViewPanel } from "@/components/game-view-panel";
import { SettingsForm } from "@/components/settings-form";
import { StartScreen } from "@/components/start-screen";
import { colors } from "@/components/theme";
import { DEFAULT_GAME_SETTINGS } from "@/utils/settings-storage";

const TEST_SEED = "test-88";

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

    const screen = render(
      <StartScreen
        isLoading={false}
        settings={DEFAULT_GAME_SETTINGS}
        onSettingsChange={handleSettingsChange}
        onStartGame={handleStartGame}
      />,
    );

    fireEvent.changeText(screen.getByLabelText("Seed"), "starter-seed");
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
    fireEvent.press(screen.getByText("hard"));
    fireEvent.press(screen.getByText("left"));
    fireEvent.press(screen.getByRole("button", { name: "Start" }));

    expect(handleSettingsChange).toHaveBeenCalledWith({ seed: "starter-seed" });
    expect(handleSettingsChange).toHaveBeenCalledWith({ appearance: "light" });
    expect(handleSettingsChange).toHaveBeenCalledWith({
      vibrationEnabled: false,
    });
    expect(handleSettingsChange).toHaveBeenCalledWith({ difficulty: "hard" });
    expect(handleSettingsChange).toHaveBeenCalledWith({ handedness: "left" });
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
    expect(
      StyleSheet.flatten(getByTestId("game-lower-layout").props.style)
        .paddingBottom,
    ).toBeGreaterThan(0);
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
    expect(getByTestId("move-up-icon").props.name).toBe("arrow-up");
    expect(getByTestId("move-left-icon").props.name).toBe("arrow-back");
    expect(getByTestId("move-right-icon").props.name).toBe("arrow-forward");
    expect(getByTestId("move-down-icon").props.name).toBe("arrow-down");

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

  it("shows emoji combatants, enemy roster, and vector status icons", () => {
    const screen = render(<GameViewPanel />);

    expect(screen.getAllByTestId("player-health-icon")).toHaveLength(10);
    expect(screen.getAllByTestId("player-energy-icon")).toHaveLength(6);
    expect(screen.getAllByTestId("enemy-health-icon")).toHaveLength(3);
    expect(screen.getAllByTestId("player-health-icon")[0].props.color).toBe(
      colors.health,
    );
    expect(screen.getAllByTestId("enemy-health-icon")[0].props.color).toBe(
      colors.health,
    );
    expect(screen.getAllByTestId("player-energy-icon")[0].props.color).toBe(
      colors.energy,
    );
    expect(screen.getByLabelText("Glitch Imp")).toHaveTextContent("👾");
    expect(screen.getByLabelText("Player warrior")).toHaveTextContent("🤺");
  });

  it("resolves an attack by damaging the enemy and then the player", () => {
    jest.useFakeTimers();

    const screen = render(
      <GameScreen
        handedness="right"
        seed={TEST_SEED}
        onGameOver={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByRole("button", { name: "Attack" }));

    expect(screen.getByLabelText("Turn status")).toHaveTextContent(
      "Resolving turn...",
    );

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(screen.getAllByTestId("enemy-health-icon")).toHaveLength(2);
    expect(screen.getAllByTestId("player-health-icon")).toHaveLength(9);
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

    fireEvent.press(screen.getByRole("button", { name: "Attack" }));

    act(() => {
      jest.advanceTimersByTime(1000);
    });

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

    fireEvent.press(screen.getByRole("button", { name: "Defend" }));

    act(() => {
      jest.advanceTimersByTime(650);
    });

    expect(screen.getAllByTestId("enemy-health-icon")).toHaveLength(3);
    expect(screen.getAllByTestId("player-health-icon")).toHaveLength(10);

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

    fireEvent.press(screen.getByRole("button", { name: "Special" }));

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(screen.getAllByTestId("enemy-health-icon")).toHaveLength(1);
    expect(screen.getAllByTestId("player-energy-icon")).toHaveLength(5);
    expect(screen.getAllByTestId("player-health-icon")).toHaveLength(9);

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

    fireEvent.press(screen.getByRole("button", { name: "Special" }));
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    fireEvent.press(screen.getByRole("button", { name: "Attack" }));
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(screen.getByLabelText("Turn status")).toHaveTextContent(
      "Facing Crypt Stumbler | Defeated 1",
    );
    expect(screen.getAllByTestId("enemy-health-icon")).toHaveLength(3);

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
      fireEvent.press(screen.getByRole("button", { name: "Special" }));
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      fireEvent.press(screen.getByRole("button", { name: "Attack" }));
      act(() => {
        jest.advanceTimersByTime(500);
      });
    }

    expect(screen.getByLabelText("Turn status")).toHaveTextContent(
      "Facing Glitch Imp | Defeated 4",
    );
    expect(screen.getAllByTestId("enemy-health-icon")).toHaveLength(3);

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
      fireEvent.press(screen.getByRole("button", { name: "Attack" }));
      act(() => {
        jest.advanceTimersByTime(1000);
      });
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
  it("marks the selected settings", () => {
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
    expect(screen.getByRole("switch", { name: "Dark Mode" }).props.value).toBe(
      true,
    );
    expect(screen.getByRole("switch", { name: "Vibration" }).props.value).toBe(
      true,
    );
    expect(
      StyleSheet.flatten(screen.getByTestId("preference-toggle-row").props.style)
        .flexDirection,
    ).toBe("row");
    expect(screen.getByDisplayValue("saved")).toBeOnTheScreen();
  });
});
