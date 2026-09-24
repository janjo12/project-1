import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";

import { RoomScene, type RoomDoorways } from "@/components/room-scene";
import { GameViewPanel } from "@/components/game-view-panel";
import { createCombatAnimationFrame } from "@/entities";

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
      bounceOffset={0}
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

test("renders an adjacent-room crossfade without animated transforms", async () => {
  jest.useFakeTimers();
  try {
    const screen = render(scene("A1"));

    await act(async () => {
      screen.rerender(scene("A2"));
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });

    expect(screen.getByTestId("room-transition-snapshot")).toBeTruthy();
    expect(screen.getByTestId("room-incoming-snapshot").props.style.transform).toBeUndefined();
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
