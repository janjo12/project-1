import { act, fireEvent, render } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/app-button";
import { EndScreen } from "@/components/end-screen";
import { GameOptionsForm } from "@/components/game-options-form";
import { GameScreen } from "@/components/game-screen";
import { GameViewPanel } from "@/components/game-view-panel";
import { ScreenShell } from "@/components/screen-shell";
import { colors, lightColors, ThemeProvider } from "@/components/theme";
import {
  createSeededDungeonMap,
  getConnectedRoomId,
  getRoom,
  getRoomMonster,
  getStairsRoom,
  POSSIBLE_MONSTERS,
  type Direction,
} from "@/utils/dungeon-map";
import { DEFAULT_GAME_SETTINGS } from "@/utils/settings-storage";

const TEST_SEED = "test-88";
const TURN_DURATION = 4000;
const reverseDirections: Record<Direction, Direction> = {
  east: "west",
  north: "south",
  south: "north",
  west: "east",
};

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
    const map = createSeededDungeonMap(TEST_SEED, 1);

    return getRoomMonster(map, getRoom(map, roomId)) !== null;
  }));
}

function followPath(screen: ReturnType<typeof render>, path: Direction[]) {
  path.forEach((direction) => {
    fireEvent.press(screen.getByRole("button", { name: `Move ${direction}` }));
  });
}

function getPathToRoom(predicate: (roomId: string) => boolean) {
  const map = createSeededDungeonMap(TEST_SEED, 1);
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
      <ScreenShell>
        <View>
          <Pressable
            accessibilityLabel="Settings"
            accessibilityRole="button"
            onPress={handleOpenSettings}
            testID="open-settings-button"
          >
            <Text>Settings</Text>
          </Pressable>
          <Text>[Title]</Text>
          <GameOptionsForm
            settings={DEFAULT_GAME_SETTINGS}
            onChange={handleSettingsChange}
          />
          <AppButton label="Start" onPress={handleStartGame} />
        </View>
      </ScreenShell>,
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
    const map = createSeededDungeonMap(TEST_SEED, 1);
    const currentRow = map.startingRoomId.match(/[A-Z]+/)![0];
    const currentColumn = map.startingRoomId.match(/\d+/)![0];
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
      StyleSheet.flatten(getByTestId(`map-room-${map.startingRoomId}`).props.style)
        .backgroundColor,
    ).toBe(colors.mapCurrentRoom);
    expect(
      StyleSheet.flatten(getByTestId(`map-row-label-${currentRow}`).props.style).color,
    ).toBe(colors.mapCurrentRoom);
    expect(
      StyleSheet.flatten(getByTestId(`map-column-label-${currentColumn}`).props.style).color,
    ).toBe(colors.mapCurrentRoom);
    expect(getByText("A")).toBeOnTheScreen();
    expect(getByText("L")).toBeOnTheScreen();
    expect(getByText("6")).toBeOnTheScreen();
    expect(
      getByTestId("action-button-cluster").children
        .filter((child) => typeof child !== "string")
        .map((child) => child.props.testID)
        .slice(0, 4),
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
    expect(getByTestId("move-east-icon")).toBeOnTheScreen();
    expect(getByTestId("use-item-button")).toHaveTextContent("No Item");
    expect(getByRole("button", { name: "No Item" }).props.accessibilityState)
      .toEqual(expect.objectContaining({ disabled: true }));

    fireEvent.press(getByRole("button", { name: "Menu" }));

    expect(getByLabelText("Game menu")).toBeOnTheScreen();
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

    fireEvent.press(getByRole("button", { name: "Back to Game" }));

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

  it("defines reusable monster objects for generated maps", () => {
    expect(POSSIBLE_MONSTERS.map((monster) => monster.name)).toEqual(
      expect.arrayContaining(["Glitch Imp", "Werewolf"]),
    );
  });

  it("shows no enemy combatant when no enemy is provided", () => {
    const screen = render(<GameViewPanel />);

    expect(screen.queryByTestId("enemy-health-bar")).toBeNull();
    expect(screen.queryByLabelText("Glitch Imp")).toBeNull();
    expect(screen.getByLabelText("Player warrior")).toBeOnTheScreen();
  });

  it("shows explicit enemy combatants and compact enemy health", () => {
    const screen = render(
      <GameViewPanel
        enemy={{
          emoji: "\uD83D\uDC7E",
          hitPoints: 3,
          name: "Glitch Imp",
        }}
        enemyMaxHitPoints={3}
      />,
    );

    expect(screen.queryByTestId("enemy-health-bar-icon")).toBeNull();
    expect(getBarFillWidth(screen, "enemy-health-bar")).toBe(100);
    const enemyHealthBarStyle = StyleSheet.flatten(
      screen.getByTestId("enemy-health-bar").props.style,
    );

    expect(enemyHealthBarStyle.height).toBe(4);
    expect(enemyHealthBarStyle.width).toBe(56);
    expect(enemyHealthBarStyle.borderWidth).toBeUndefined();
    expect(screen.getByLabelText("Glitch Imp")).toHaveTextContent(
      "\uD83D\uDC7E",
    );
    expect(screen.getByLabelText("Player warrior")).toBeOnTheScreen();
  });

  it("shows multiple room actors together", () => {
    const screen = render(
      <GameViewPanel
        roomSceneActors={[
          {
            currentHealth: 2,
            emoji: "\uD83D\uDC7E",
            kind: "enemy",
            label: "Glitch Imp",
            maxHealth: 3,
          },
          {
            emoji: "\uD83D\udd11",
            kind: "item",
            label: "Key",
          },
          {
            emoji: "🪜",
            kind: "stairs",
            label: "Stairs",
          },
        ]}
      />,
    );

    expect(screen.getByLabelText("Glitch Imp")).toHaveTextContent(
      "\uD83D\uDC7E",
    );
    expect(screen.getByLabelText("Key")).toHaveTextContent("\uD83D\udd11");
    expect(screen.getByLabelText("Stairs")).toHaveTextContent("🪜");
    expect(screen.getByLabelText("Player warrior")).toBeOnTheScreen();
  });

  it("uses a brighter current-room map highlight in light mode", () => {
    const map = createSeededDungeonMap(TEST_SEED, 1);
    const currentRow = map.startingRoomId.match(/[A-Z]+/)![0];
    const currentColumn = map.startingRoomId.match(/\d+/)![0];
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
      StyleSheet.flatten(screen.getByTestId(`map-room-${map.startingRoomId}`).props.style)
        .backgroundColor,
    ).toBe(lightColors.mapCurrentRoom);
    expect(
      StyleSheet.flatten(screen.getByTestId(`map-row-label-${currentRow}`).props.style)
        .color,
    ).toBe(lightColors.mapCurrentRoom);
    expect(
      StyleSheet.flatten(screen.getByTestId(`map-column-label-${currentColumn}`).props.style)
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

  it.each(["normal", "hard"] as const)(
    "defaults to defend when the %s turn timer runs out",
    (difficulty) => {
    const screen = render(
      <GameScreen
        difficulty={difficulty}
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
    },
  );

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

  it("restarts the turn timer after a movement action", () => {
    const screen = render(
      <GameScreen
        difficulty="normal"
        handedness="right"
        seed={TEST_SEED}
        onGameOver={jest.fn()}
      />,
    );
    const firstMoveDirection: Direction = "north";

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(getBarFillWidth(screen, "turn-timer")).toBeLessThan(100);

    clearCurrentRoom(screen);

    fireEvent.press(
      screen.getByRole("button", { name: `Move ${firstMoveDirection}` }),
    );

    expect(getBarFillWidth(screen, "turn-timer")).toBe(100);
  });

  it("pauses and resumes the turn timer from the game menu", () => {
    const handleSettingsChange = jest.fn();
    const screen = render(
      <GameScreen
        difficulty="normal"
        handedness="right"
        seed={TEST_SEED}
        settings={DEFAULT_GAME_SETTINGS}
        onGameOver={jest.fn()}
        onSettingsChange={handleSettingsChange}
      />,
    );

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    const pausedWidth = getBarFillWidth(screen, "turn-timer");

    fireEvent.press(screen.getByRole("button", { name: "Menu" }));
    fireEvent(
      screen.getByRole("switch", { name: "Dark Mode" }),
      "valueChange",
      true,
    );
    fireEvent(
      screen.getByRole("switch", { name: "Vibration" }),
      "valueChange",
      false,
    );

    act(() => {
      jest.advanceTimersByTime(TURN_DURATION);
    });

    expect(getBarFillWidth(screen, "turn-timer")).toBeCloseTo(pausedWidth, 1);
    expect(handleSettingsChange).toHaveBeenCalledWith({ appearance: "dark" });
    expect(handleSettingsChange).toHaveBeenCalledWith({
      vibrationEnabled: false,
    });

    fireEvent.press(screen.getByRole("button", { name: "Back to Game" }));

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(getBarFillWidth(screen, "turn-timer")).toBeLessThan(pausedWidth);
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
    clearCurrentRoom(screen);

    fireEvent.press(screen.getByRole("button", { name: "Move north" }));

    expect(screen.getByLabelText("Turn status")).toHaveTextContent(
      /Level 1/,
    );
    expect(screen.getByLabelText("Turn status")).not.toHaveTextContent(
      "Room J1 clear",
    );
  });

  it("does not let enemies act after the player moves to a different room", () => {
    const screen = render(
      <GameScreen
        handedness="right"
        seed={TEST_SEED}
        onGameOver={jest.fn()}
      />,
    );

    clearCurrentRoom(screen);

    fireEvent.press(screen.getByRole("button", { name: "Move north" }));
    resolveTurnTimers();
    expect(screen.getByLabelText("Turn status")).toHaveTextContent(
      /Level 1/,
    );

    expect(getBarFillWidth(screen, "player-health-bar")).toBe(100);
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

    const map = createSeededDungeonMap(TEST_SEED, 1);

    clearCurrentRoom(screen);

    followPath(screen, getPathToRoom((roomId) => roomId === getStairsRoom(map)!.id));

    expect(screen.getByTestId("descend-button")).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId("descend-button"));

    expect(screen.getByLabelText("Level 2 Map")).toBeOnTheScreen();
    expect(screen.getByLabelText("Turn status")).toHaveTextContent(
      /Room .+ clear \| Level 2 \| Cleared 1/,
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

describe("GameOptionsForm", () => {
  it("marks the selected game setup settings", () => {
    const screen = render(
      <GameOptionsForm
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
