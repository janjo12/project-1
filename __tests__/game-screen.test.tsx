import * as Haptics from "expo-haptics";
import { act, fireEvent, render } from "@testing-library/react-native";
import { Alert, StyleSheet } from "react-native";

import { EndScreen } from "@/components/end-screen";
import { GameScreen } from "@/components/game-screen";
import { GameViewPanel } from "@/components/game-view-panel";
import { SettingsScreen } from "@/components/settings-screen";
import { SettingsForm } from "@/components/settings-form";
import { StartScreen } from "@/components/start-screen";
import { colors, lightColors, ThemeProvider } from "@/components/theme";
import { getSeededEnemyRoster } from "@/entities";
import {
  createSeededDungeonMap,
  getConnectedRoomId,
  getRoom,
  getRoomEnemyIndex,
  type Direction,
} from "@/utils/dungeon-map";
import { DEFAULT_GAME_SETTINGS } from "@/utils/settings-storage";

const TEST_SEED = "test-88";
const TURN_DURATION = 4000;

function getBarFillWidth(screen: ReturnType<typeof render>, testID: string) {
  return parseFloat(
    StyleSheet.flatten(screen.getByTestId(`${testID}-fill`).props.style).width,
  );
}

function resolveTurnTimers() {
  act(() => {
    jest.advanceTimersByTime(1200);
  });
}

function clearCurrentRoom(screen: ReturnType<typeof render>) {
  fireEvent.press(screen.getByTestId("special-action-button"));
  resolveTurnTimers();
  fireEvent.press(screen.getByTestId("attack-action-button"));
  resolveTurnTimers();
}

function moveToFirstEnemyRoom(screen: ReturnType<typeof render>) {
  followPath(screen, getPathToRoom((roomId) => {
    const map = createSeededDungeonMap(TEST_SEED, 1, 4);

    return getRoomEnemyIndex(getRoom(map, roomId)) !== null;
  }));
}

function followPath(screen: ReturnType<typeof render>, path: Direction[]) {
  path.forEach((direction) => {
    fireEvent.press(screen.getByRole("button", { name: `Move ${direction}` }));
  });
}

function getPathToRoom(predicate: (roomId: string) => boolean) {
  const map = createSeededDungeonMap(TEST_SEED, 1, 4);
  const queue: { path: Direction[]; roomId: string }[] = [
    { path: [], roomId: map.startingRoomId },
  ];
  const seenRoomIds = new Set([map.startingRoomId]);
  const directions: Direction[] = ["north", "east", "south", "west"];

  while (queue.length > 0) {
    const { path, roomId } = queue.shift()!;

    if (path.length > 0 && predicate(roomId)) {
      return path;
    }

    directions.forEach((direction) => {
      const nextRoomId = getConnectedRoomId(map, roomId, direction);

      if (!nextRoomId || seenRoomIds.has(nextRoomId)) {
        return;
      }

      seenRoomIds.add(nextRoomId);
      queue.push({ path: [...path, direction], roomId: nextRoomId });
    });
  }

  return [];
}

describe("game screens", () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation();
  });

  afterEach(() => {
    alertSpy.mockRestore();
    jest.useRealTimers();
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
    const { getByLabelText, getByRole, getByTestId, getByText, rerender } = render(
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
    expect(getByLabelText("Level 1 Map")).toBeOnTheScreen();
    expect(getByText("Level 1 Map")).toBeOnTheScreen();
    expect(getByTestId("turn-timer-icon").props.color).toBe("#a855f7");
    expect(
      StyleSheet.flatten(getByTestId("map-room-E2").props.style)
        .backgroundColor,
    ).toBe(colors.mapCurrentRoom);
    expect(
      StyleSheet.flatten(getByTestId("map-column-label-E").props.style).color,
    ).toBe(colors.mapCurrentRoom);
    expect(
      StyleSheet.flatten(getByTestId("map-row-label-2").props.style).color,
    ).toBe(colors.mapCurrentRoom);
    expect(getByText("A")).toBeOnTheScreen();
    expect(getByText("12")).toBeOnTheScreen();
    expect(
      getByTestId("action-button-cluster").children
        .filter((child) => typeof child !== "string")
        .map((child) => child.props.testID),
    ).toEqual([
      "use-item-button",
      "special-action-button",
      "attack-action-button",
      "defend-action-button",
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
        getByTestId("direction-controls").props.style,
      ).opacity,
    ).toBe(1);
    expect(
      StyleSheet.flatten(getByTestId("direction-controls").props.style).height,
    ).toBe(110);
    expect(getByTestId("move-north-icon")).toBeOnTheScreen();
    expect(
      getByRole("button", { name: "Move south" }).props.accessibilityState,
    ).toEqual(expect.objectContaining({ disabled: true }));
    expect(getByTestId("use-item-button")).toHaveTextContent("Use Item");
    expect(getByRole("button", { name: "Use Item" }).props.accessibilityState)
      .toEqual(expect.objectContaining({ disabled: true }));

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

  it("uses a darker current-room map highlight in light mode", () => {
    const screen = render(
      <ThemeProvider appearance="light">
        <GameScreen
          handedness="right"
          seed={TEST_SEED}
          onGameOver={jest.fn()}
        />
      </ThemeProvider>,
    );

    expect(
      StyleSheet.flatten(screen.getByTestId("map-room-E2").props.style)
        .backgroundColor,
    ).toBe(lightColors.mapCurrentRoom);
    expect(
      StyleSheet.flatten(screen.getByTestId("map-column-label-E").props.style)
        .color,
    ).toBe(lightColors.mapCurrentRoom);
    expect(
      StyleSheet.flatten(screen.getByTestId("map-row-label-2").props.style)
        .color,
    ).toBe(lightColors.mapCurrentRoom);
  });

  it("attacks and resolves player then enemy damage", () => {
    const screen = render(
      <GameScreen
        handedness="right"
        seed={TEST_SEED}
        onGameOver={jest.fn()}
      />,
    );

    moveToFirstEnemyRoom(screen);
    fireEvent.press(screen.getByTestId("attack-action-button"));

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
      /Facing .+ \| Level 1 \| Room .+/,
    );
  });

  it("does not vibrate when vibration is disabled", () => {
    const screen = render(
      <GameScreen
        handedness="right"
        seed={TEST_SEED}
        vibrationEnabled={false}
        onGameOver={jest.fn()}
      />,
    );

    moveToFirstEnemyRoom(screen);
    fireEvent.press(screen.getByTestId("attack-action-button"));
    resolveTurnTimers();

    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  it("defends against enemy damage for the turn", () => {
    const screen = render(
      <GameScreen
        handedness="right"
        seed={TEST_SEED}
        onGameOver={jest.fn()}
      />,
    );

    moveToFirstEnemyRoom(screen);
    fireEvent.press(screen.getByTestId("defend-action-button"));
    resolveTurnTimers();

    expect(getBarFillWidth(screen, "enemy-health-bar")).toBe(100);
    expect(getBarFillWidth(screen, "player-health-bar")).toBe(100);
  });

  it("defaults to defend when the turn timer runs out with no selected action", () => {
    const screen = render(
      <GameScreen
        handedness="right"
        seed={TEST_SEED}
        onGameOver={jest.fn()}
      />,
    );

    moveToFirstEnemyRoom(screen);

    act(() => {
      jest.advanceTimersByTime(TURN_DURATION + 650);
    });

    expect(getBarFillWidth(screen, "enemy-health-bar")).toBe(100);
    expect(getBarFillWidth(screen, "player-health-bar")).toBe(100);
  });

  it("does not render or expire the turn timer on easy difficulty", () => {
    const screen = render(
      <GameScreen
        difficulty="easy"
        handedness="right"
        seed={TEST_SEED}
        onGameOver={jest.fn()}
      />,
    );

    expect(screen.queryByTestId("turn-timer")).toBeNull();

    moveToFirstEnemyRoom(screen);

    act(() => {
      jest.advanceTimersByTime(TURN_DURATION + 1200);
    });

    expect(screen.getByLabelText("Turn status")).toHaveTextContent(
      /Facing .+ \| Level 1 \| Room .+/,
    );
    expect(getBarFillWidth(screen, "player-health-bar")).toBe(100);
  });

  it("uses energy for a special attack that deals double damage", () => {
    const screen = render(
      <GameScreen
        handedness="right"
        seed={TEST_SEED}
        onGameOver={jest.fn()}
      />,
    );

    moveToFirstEnemyRoom(screen);
    fireEvent.press(screen.getByTestId("special-action-button"));
    resolveTurnTimers();

    expect(getBarFillWidth(screen, "enemy-health-bar")).toBeCloseTo(33.33, 1);
    expect(getBarFillWidth(screen, "player-energy-bar")).toBeCloseTo(83.33, 1);
    expect(getBarFillWidth(screen, "player-health-bar")).toBe(90);
    expect(screen.getByTestId("player-energy-loss")).toHaveTextContent("- 1");
  });

  it("clears a room after defeating its enemy", () => {
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
    expect(screen.getByLabelText("Werewolf roster enemy")).toBeOnTheScreen();

    moveToFirstEnemyRoom(screen);
    expect(screen.getByLabelText("Turn status")).toHaveTextContent(
      /Facing .+ \| Level 1 \| Room .+/,
    );
    clearCurrentRoom(screen);

    expect(screen.getByLabelText("Turn status")).toHaveTextContent(
      /Room .+ clear \| Level 1 \| Cleared 0/,
    );
    expect(getBarFillWidth(screen, "enemy-health-bar")).toBe(0);
  });

  it("moves between connected rooms with the d-pad", () => {
    const screen = render(
      <GameScreen
        handedness="right"
        seed={TEST_SEED}
        onGameOver={jest.fn()}
      />,
    );

    moveToFirstEnemyRoom(screen);

    expect(screen.getByLabelText("Turn status")).toHaveTextContent(
      /Facing .+ \| Level 1 \| Room .+/,
    );
  });

  it("does not report a cleared-level score before reaching stairs", () => {
    const handleGameOver = jest.fn();

    const screen = render(
      <GameScreen
        handedness="right"
        seed={TEST_SEED}
        onGameOver={handleGameOver}
      />,
    );

    moveToFirstEnemyRoom(screen);
    clearCurrentRoom(screen);

    expect(handleGameOver).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Turn status")).toHaveTextContent(
      /Room .+ clear \| Level 1 \| Cleared 0/,
    );
  });

  it("generates the next level and refills resources after clearing the stairs room", () => {
    const screen = render(
      <GameScreen
        handedness="right"
        seed={TEST_SEED}
        onGameOver={jest.fn()}
      />,
    );

    const map = createSeededDungeonMap(TEST_SEED, 1, 4);

    followPath(screen, getPathToRoom((roomId) => roomId === map.stairsRoomId));

    expect(screen.getByLabelText("Level 2 Map")).toBeOnTheScreen();
    expect(screen.getByLabelText("Turn status")).toHaveTextContent(
      "Room A7 clear | Level 2 | Cleared 1",
    );
    expect(getBarFillWidth(screen, "player-health-bar")).toBe(100);
    expect(getBarFillWidth(screen, "player-energy-bar")).toBe(100);
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
