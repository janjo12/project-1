import { act, fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { EndScreen } from "@/components/end-screen";
import { GameScreen } from "@/components/game-screen";
import { GameViewPanel } from "@/components/game-view-panel";
import { SettingsForm } from "@/components/settings-form";
import { StartScreen } from "@/components/start-screen";
import { DEFAULT_GAME_SETTINGS } from "@/utils/settings-storage";

describe("game screens", () => {
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
    fireEvent.press(screen.getByText("hard"));
    fireEvent.press(screen.getByText("left"));
    fireEvent.press(screen.getByRole("button", { name: "Start" }));

    expect(handleSettingsChange).toHaveBeenCalledWith({ seed: "starter-seed" });
    expect(handleSettingsChange).toHaveBeenCalledWith({ difficulty: "hard" });
    expect(handleSettingsChange).toHaveBeenCalledWith({ handedness: "left" });
    expect(handleStartGame).toHaveBeenCalledTimes(1);
  });

  it("mirrors the game controls for left-handed play", () => {
    const { getByTestId, rerender } = render(
      <GameScreen handedness="right" onGameOver={jest.fn()} />,
    );

    expect(
      StyleSheet.flatten(getByTestId("game-lower-layout").props.style)
        .flexDirection,
    ).toBe("row");

    rerender(<GameScreen handedness="left" onGameOver={jest.fn()} />);

    expect(
      StyleSheet.flatten(getByTestId("game-lower-layout").props.style)
        .flexDirection,
    ).toBe("row-reverse");
  });

  it("shows emoji combatants, enemy roster, and player status icons", () => {
    const screen = render(<GameViewPanel />);

    expect(screen.getByLabelText("Player health")).toHaveTextContent(
      "❤️ ❤️ ❤️ ❤️ ❤️ ❤️ ❤️ ❤️ ❤️ ❤️",
    );
    expect(screen.getByLabelText("Player energy")).toHaveTextContent(
      "⚡ ⚡ ⚡ ⚡ ⚡ ⚡",
    );
    expect(screen.getByLabelText("Glitch Imp")).toHaveTextContent("👾");
    expect(screen.getByLabelText("Enemy health")).toHaveTextContent(
      "❤️ ❤️ ❤️",
    );
    expect(screen.getByLabelText("Player warrior")).toHaveTextContent("🤺");
  });

  it("resolves an attack by damaging the enemy and then the player", () => {
    jest.useFakeTimers();

    const screen = render(
      <GameScreen handedness="right" onGameOver={jest.fn()} />,
    );

    fireEvent.press(screen.getByRole("button", { name: "Attack" }));

    expect(screen.getByLabelText("Turn status")).toHaveTextContent(
      "Resolving turn...",
    );

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(screen.getByLabelText("Enemy health")).toHaveTextContent("❤️ ❤️");
    expect(screen.getByLabelText("Player health")).toHaveTextContent(
      "❤️ ❤️ ❤️ ❤️ ❤️ ❤️ ❤️ ❤️ ❤️",
    );
    expect(screen.getByLabelText("Turn status")).toHaveTextContent(
      "Facing Glitch Imp | Defeated 0",
    );

    jest.useRealTimers();
  });

  it("defends against enemy damage for the turn", () => {
    jest.useFakeTimers();

    const screen = render(
      <GameScreen handedness="right" onGameOver={jest.fn()} />,
    );

    fireEvent.press(screen.getByRole("button", { name: "Defend" }));

    act(() => {
      jest.advanceTimersByTime(650);
    });

    expect(screen.getByLabelText("Enemy health")).toHaveTextContent(
      "❤️ ❤️ ❤️",
    );
    expect(screen.getByLabelText("Player health")).toHaveTextContent(
      "❤️ ❤️ ❤️ ❤️ ❤️ ❤️ ❤️ ❤️ ❤️ ❤️",
    );

    jest.useRealTimers();
  });

  it("uses energy for a special attack that deals double damage", () => {
    jest.useFakeTimers();

    const screen = render(
      <GameScreen handedness="right" onGameOver={jest.fn()} />,
    );

    fireEvent.press(screen.getByRole("button", { name: "Special" }));

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(screen.getByLabelText("Enemy health")).toHaveTextContent("❤️");
    expect(screen.getByLabelText("Player energy")).toHaveTextContent(
      "⚡ ⚡ ⚡ ⚡ ⚡",
    );
    expect(screen.getByLabelText("Player health")).toHaveTextContent(
      "❤️ ❤️ ❤️ ❤️ ❤️ ❤️ ❤️ ❤️ ❤️",
    );

    jest.useRealTimers();
  });

  it("advances through multiple emoji enemies", () => {
    jest.useFakeTimers();

    const screen = render(
      <GameScreen handedness="right" onGameOver={jest.fn()} />,
    );

    expect(screen.getByLabelText("Glitch Imp roster enemy")).toHaveTextContent(
      "👾",
    );
    expect(
      screen.getByLabelText("Crypt Stumbler roster enemy"),
    ).toHaveTextContent("🧟");
    expect(screen.getByLabelText("Tiny Dragon roster enemy")).toHaveTextContent(
      "🐉",
    );
    expect(screen.getByLabelText("Night Count roster enemy")).toHaveTextContent(
      "🧛",
    );

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
    expect(screen.getByLabelText("Enemy health")).toHaveTextContent(
      "❤️ ❤️ ❤️",
    );

    jest.useRealTimers();
  });

  it("cycles enemies indefinitely instead of ending after the roster", () => {
    jest.useFakeTimers();

    const screen = render(
      <GameScreen handedness="right" onGameOver={jest.fn()} />,
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
    expect(screen.getByLabelText("Enemy health")).toHaveTextContent(
      "❤️ ❤️ ❤️",
    );

    jest.useRealTimers();
  });

  it("reports defeated enemies when the player dies", () => {
    jest.useFakeTimers();
    const handleGameOver = jest.fn();

    const screen = render(
      <GameScreen handedness="right" onGameOver={handleGameOver} />,
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
          difficulty: "easy",
          handedness: "left",
          seed: "saved",
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
    expect(screen.getByDisplayValue("saved")).toBeOnTheScreen();
  });
});
