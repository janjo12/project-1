import React from "react";
import { act, fireEvent, render, within } from "@testing-library/react-native";
import { PixelSprite } from "@/components/Common/PixelSprite";

import { RoomScene, type RoomDoorways } from "@/components/Dungeon/Room";
import { GameViewPanel } from "@/components/Dungeon/GameViewPanel";
import { CombatantSprite } from "@/components/Enemy/Enemy";
import { createCombatAnimationFrame } from "@/game/entities";
import { GAME_PARAMETERS } from "@/game/config/gameparameters";

const doorways: RoomDoorways = {
  bottom: "open",
  left: "wall",
  right: "wall",
  top: "wall",
};

function scene(roomId: string, playerPosition: "top" | "right" | "bottom" | "left" | "center" = "center", sceneDoorways = doorways) {
  return (
    <RoomScene
      actors={[]}
      animationFrame={createCombatAnimationFrame()}
      doorways={sceneDoorways}
      enemyHealthLossAmount={0}
      playerEnergyLossAmount={0}
      playerHealthLossAmount={0}
      playerPosition={playerPosition}
      playerSprite="🛡️"
      roomId={roomId}
      sceneScale={1}
    />
  );
}

test("the outer room border has doorway gaps while guarded-doorway markers stay on the display map", async () => {
  const screen = await render(scene("A1", "center", {
    top: "guarded",
    right: "locked",
    bottom: "open",
    left: "wall",
  }));

  expect(screen.getByTestId("room-frame-gap-top")).toBeTruthy();
  expect(screen.getByTestId("room-frame-gap-right")).toBeTruthy();
  expect(screen.getByTestId("room-frame-gap-bottom")).toBeTruthy();
  expect(screen.queryByTestId("room-frame-gap-left")).toBeNull();
  expect(screen.getByRole("button", { name: "top guarded doorway" })).toBeTruthy();
  expect(screen.queryByText("×")).toBeNull();
  expect(screen.getByText("🔒")).toBeTruthy();
  expect(screen.getByText("↓")).toBeTruthy();
});

test("a Werewolf hit with no damage shows No Effect in the floating damage position", async () => {
  const animationFrame = { ...createCombatAnimationFrame(), enemyHealthLossElapsed: 40 };
  const screen = await render(
    <RoomScene
      actors={[{ id: "werewolf", currentHealth: 1, isWerewolf: true, kind: "enemy", label: "Werewolf", maxHealth: 1, sprite: "werewolf_graphic" }]}
      animationFrame={animationFrame}
      doorways={doorways}
      enemyHealthLossAmount={0}
      playerEnergyLossAmount={0}
      playerHealthLossAmount={0}
      playerPosition="center"
      playerSprite="warrior_graphic"
      roomId="A1"
      sceneScale={1}
    />,
  );

  expect(screen.getByTestId("werewolf-no-effect")).toHaveTextContent("No Effect!");
  expect(screen.queryByTestId("enemy-health-loss")).toBeNull();
});

test("support feedback is shown over the selected ally", async () => {
  const screen = await render(
    <RoomScene
      actors={[{ id: "ally", kind: "player", label: "Cleric · ally", sprite: "cleric_graphic", position: "center" }]}
      doorways={doorways}
      enemyHealthLossAmount={0}
      playerEnergyLossAmount={0}
      playerHealthLossAmount={0}
      playerPosition="center"
      playerSprite="warrior_graphic"
      roomId="A1"
      sceneScale={1}
      supportEffect={{ targetId: "ally", emoji: "🛡️", label: "Vanguard", key: 1 }}
    />,
  );

  expect(within(screen.getByRole("button", { name: "Cleric · ally" })).getByText("Vanguard")).toBeTruthy();
  expect(screen.getAllByTestId("support-feedback")).toHaveLength(1);
});

test("moving from an already aligned position still animates the player toward the doorway", async () => {
  const screen = await render(scene("A1", "center"));

  await act(async () => {
    await screen.rerender(scene("A1", "bottom"));
  });

  const exitAnimation = screen.getByTestId("player-room-exit-animation");
  expect(exitAnimation.props.style.animationDuration).toBe(`${GAME_PARAMETERS.animation.roomExitDurationMs}ms`);
  expect(exitAnimation.props.style.animationName.to).toEqual({ transform: [{ translateY: 34 }] });
});

test("player sprite scale stays constant when moving from the room center to a doorway", async () => {
  const screen = await render(scene("A1", "center"));
  const initialScale = screen.getByTestId("player-sprite-envelope").props.style.transform;

  await screen.rerender(scene("A2", "top"));

  expect(screen.getByTestId("player-sprite-envelope").props.style.transform).toEqual(initialScale);
});

test("shows the new room directly without replaying the previous room snapshot", async () => {
  jest.useFakeTimers();
  try {
    const screen = await render(scene("A1"));

    await act(async () => {
      await screen.rerender(scene("A2"));
      await Promise.resolve();
    });

    expect(screen.queryByTestId("room-transition-snapshot")).toBeNull();
    const incomingRoom = screen.getByTestId("room-incoming-snapshot");
    expect(incomingRoom.props.style.animationName).toBeDefined();
    expect(within(incomingRoom).getByTestId("tiled-room-floor")).toBeTruthy();
    expect(screen.getAllByTestId("tiled-room-floor")).toHaveLength(1);
    expect(screen.getByTestId("room-incoming-snapshot").props.style.transform).toBeUndefined();

    await act(async () => {
      jest.advanceTimersByTime(GAME_PARAMETERS.animation.roomTransitionDurationMs);
    });
    expect(screen.queryByTestId("room-transition-snapshot")).toBeNull();
  } finally {
    jest.useRealTimers();
  }
});

test("pauses player idle bob until the room-entry slide reaches its spot", async () => {
  jest.useFakeTimers();
  try {
    const screen = await render(scene("A1"));
    const idleLayer = screen.getByTestId("combatant-sprite-idle-layer");
    expect(idleLayer.props.style[1].animationPlayState).toBe("running");

    await act(async () => {
      await screen.rerender(scene("A2"));
      await Promise.resolve();
    });
    expect(screen.getByTestId("combatant-sprite-idle-layer").props.style[1].animationPlayState).toBe("paused");

    await act(async () => {
      jest.advanceTimersByTime(GAME_PARAMETERS.animation.roomTransitionDurationMs);
    });
    expect(screen.getByTestId("combatant-sprite-idle-layer").props.style[1].animationPlayState).toBe("running");
  } finally {
    jest.useRealTimers();
  }
});

test("pressing an enemy sends that actor to the game handler", async () => {
  const onActorPress = jest.fn();
  const zombie = {
    id: "zombie",
    kind: "enemy" as const,
    label: "Zombie",
    sprite: "🧟",
    position: "center" as const,
  };
  const screen = await render(
    <GameViewPanel
      animationFrame={createCombatAnimationFrame()}
      onActorPress={onActorPress}
      roomDoorways={doorways}
      roomSceneActors={[zombie]}
    />,
  );

  await fireEvent.press(screen.getByRole("button", { name: "Zombie" }));

  expect(onActorPress).toHaveBeenCalledWith(zombie);
  expect(screen.queryByText("Zombie")).toBeNull();
  expect(screen.queryByText("Player")).toBeNull();
});

test("loot chests render only the chest sprite while keeping an accessible pickup name", async () => {
  const chest = {
    id: "health-potion-room-item",
    kind: "item" as const,
    label: "Chest containing Health Potion",
    sprite: "chest_closed_graphic",
    contentSprite: "health_potion_graphic",
    isChest: true,
    position: "center" as const,
  };
  const screen = await render(
    <GameViewPanel
      animationFrame={createCombatAnimationFrame()}
      roomDoorways={doorways}
      roomSceneActors={[chest]}
    />,
  );

  expect(screen.getByRole("button", { name: "Chest containing Health Potion" })).toBeTruthy();
  expect(screen.queryByText("Chest containing Health Potion")).toBeNull();
  expect(screen.queryByText("Player")).toBeNull();
  expect(screen.getAllByTestId("pixel-sprite-image").length).toBeGreaterThan(0);
});

test("a failed sprite image falls back, and switching sprites retries the new image", async () => {
  const screen = await render(<PixelSprite label="Warrior" size={24} sprite="warrior_graphic" />);

  await fireEvent(screen.getByTestId("pixel-sprite-image"), "error");
  expect(screen.getByText("❔")).toBeTruthy();

  await screen.rerender(<PixelSprite label="Zombie" size={24} sprite="zombie_graphic" />);
  expect(screen.getByTestId("pixel-sprite-image")).toBeTruthy();

  await screen.rerender(<PixelSprite label="Warrior" size={24} sprite="warrior_graphic" />);
  expect(screen.getByTestId("pixel-sprite-image")).toBeTruthy();
});

test("player idle animation style stays stable as combat progress updates", async () => {
  const sprite = (attackProgress: number | null, animationsPaused = false) => (
    <CombatantSprite
      accessibilityLabel="Player"
      attackDirection="left"
      attackProgress={attackProgress}
      damageProgress={null}
      animationsPaused={animationsPaused}
      idleAnimationPaused={false}
      sprite="warrior_graphic"
      size={56}
    />
  );
  const screen = await render(sprite(null));
  const idleLayer = screen.getByTestId("combatant-sprite-idle-layer");
  const idleStyle = idleLayer.props.style;

  await screen.rerender(sprite(0.5, true));

  expect(screen.getByTestId("combatant-sprite-idle-layer").props.style).toBe(idleStyle);
});

test("player idle bob keeps running while gameplay effects are paused", async () => {
  const screen = await render(
    <RoomScene
      actors={[]}
      animationsPaused
      animationFrame={createCombatAnimationFrame()}
      doorways={doorways}
      enemyHealthLossAmount={0}
      playerEnergyLossAmount={0}
      playerHealthLossAmount={0}
      playerPosition="center"
      playerSprite="warrior_graphic"
      roomId="A1"
      sceneScale={1}
    />,
  );

  const idleLayer = screen.getByTestId("combatant-sprite-idle-layer");
  expect(idleLayer.props.style[1].animationPlayState).toBe("running");
});

test("player keeps clear of the doorway arrow after entering from an edge", async () => {
  const screen = await render(scene("A1", "left"));
  const playerStyle = screen.getByTestId("local-player-actor").props.style;
  const flattened = Array.isArray(playerStyle) ? Object.assign({}, ...playerStyle.filter(value => typeof value === "object")) : playerStyle;

  expect(flattened.left).toBeGreaterThan(40);
});
