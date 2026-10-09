import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { PixelSprite } from "@/components/Common/PixelSprite";

import { RoomScene, type RoomDoorways } from "@/components/Dungeon/Room";
import { GameViewPanel } from "@/components/Dungeon/GameViewPanel";
import { createCombatAnimationFrame } from "@/game/entities";

const doorways: RoomDoorways = {
  bottom: "open",
  left: "wall",
  right: "wall",
  top: "wall",
};

function scene(roomId: string) {
  return (
    <RoomScene
      actors={[]}
      animationFrame={createCombatAnimationFrame()}
      doorways={doorways}
      enemyHealthLossAmount={0}
      playerEnergyLossAmount={0}
      playerHealthLossAmount={0}
      playerPosition="center"
      playerSprite="🛡️"
      roomId={roomId}
      sceneScale={1}
    />
  );
}

test("crossfades adjacent rooms with UI-side opacity keyframes", async () => {
  jest.useFakeTimers();
  try {
    const screen = render(scene("A1"));

    await act(async () => {
      screen.rerender(scene("A2"));
      await Promise.resolve();
    });

    expect(screen.getByTestId("room-transition-snapshot")).toBeTruthy();
    expect(screen.getByTestId("room-transition-snapshot").props.style.animationName).toBeDefined();
    expect(screen.getByTestId("room-incoming-snapshot").props.style.animationName).toBeDefined();
    expect(screen.getByTestId("room-incoming-snapshot").props.style.transform).toBeUndefined();

    await act(async () => {
      jest.advanceTimersByTime(250);
    });
    expect(screen.queryByTestId("room-transition-snapshot")).toBeNull();
  } finally {
    jest.useRealTimers();
  }
});

test("pressing an enemy sends that actor to the game handler", () => {
  const onActorPress = jest.fn();
  const zombie = {
    id: "zombie",
    kind: "enemy" as const,
    label: "Zombie",
    sprite: "🧟",
    position: "center" as const,
  };
  const screen = render(
    <GameViewPanel
      animationFrame={createCombatAnimationFrame()}
      onActorPress={onActorPress}
      roomDoorways={doorways}
      roomSceneActors={[zombie]}
    />,
  );

  fireEvent.press(screen.getByRole("button", { name: "Zombie" }));

  expect(onActorPress).toHaveBeenCalledWith(zombie);
});

test("a failed sprite image falls back, and switching sprites retries the new image", () => {
  const screen = render(<PixelSprite label="Warrior" size={24} sprite="warrior_graphic" />);

  fireEvent(screen.getByTestId("pixel-sprite-image"), "error");
  expect(screen.getByText("[warrior_graphic]")).toBeTruthy();

  screen.rerender(<PixelSprite label="Zombie" size={24} sprite="zombie_graphic" />);
  expect(screen.getByTestId("pixel-sprite-image")).toBeTruthy();

  screen.rerender(<PixelSprite label="Warrior" size={24} sprite="warrior_graphic" />);
  expect(screen.getByTestId("pixel-sprite-image")).toBeTruthy();
});
