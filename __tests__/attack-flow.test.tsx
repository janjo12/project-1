import React from "react";
import { act, fireEvent, render, renderHook } from "@testing-library/react-native";

import { ThemeProvider } from "@/components/Common/theme";
import { GameViewPanel, type RoomSceneActor } from "@/components/Dungeon/GameViewPanel";
import { MicrogameOverlay } from "@/components/Common/MicrogameOverlay";
import { getRoomSceneActors } from "@/game/engine/run-game-scene";
import { useRunGame } from "@/game/engine/run-game-singleplayer";
import { getTimedAttackScore, useMicrogame } from "@/game/actions/use-microgame";
import { createSeededDungeonMap } from "@/game/dungeon/generateDungeon";
import type { DungeonMap } from "@/game/dungeon/types";
import { getRoom } from "@/game/dungeon/rooms";

jest.mock("@/game/dungeon/mapStorage", () => ({
  createAndSaveSeededDungeonMap: jest.fn(async () => null),
  saveDungeonMap: jest.fn(async () => undefined),
  updateStoredDungeonMap: jest.fn(async () => null),
}));
jest.mock("@/game/engine/run-game-helpers", () => ({
  ...jest.requireActual("@/game/engine/run-game-helpers"),
  createLevelMap: jest.fn(),
}));

function attackMap(): DungeonMap {
  const map = createSeededDungeonMap("attack-flow", 1);
  map.rooms.flat().forEach((room) => {
    room.contents = [];
    room.north = room.south = room.east = room.west = "wall";
    room.isCurrentPosition = room.id === "A1";
  });
  map.startingRoomId = "A1";
  map.entities = { items: {}, equipment: {}, monsters: {}, doorwayGuards: {} };
  map.entities.monsters.zombie = {
    currentHealth: 20,
    damage: 0,
    id: "zombie",
    maximumHealth: 20,
    name: "Zombie",
    sprite: "🧟",
    type: "monster",
  };
  getRoom(map, "A1")!.contents = [{ id: "zombie", type: "monster" }];
  return map;
}

async function setupGame() {
  const map = attackMap();
  require("@/game/engine/run-game-helpers").createLevelMap.mockReturnValue(map);
  require("@/game/dungeon/mapStorage").createAndSaveSeededDungeonMap.mockResolvedValue(map);
  const hook = renderHook(() => useRunGame({
    difficulty: "easy",
    istest: false,
    seed: "attack-flow",
    vibrationEnabled: false,
    onGameOver: jest.fn(),
  }));
  await act(async () => {});
  return hook;
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test("pressing an enemy, completing a middling attack, and continuing lowers stored and displayed health", async () => {
  let now = 1000;
  jest.spyOn(globalThis.performance, "now").mockImplementation(() => now);

  try {
    const { result } = await setupGame();
    const initialMonster = result.current.dungeonMap.entities.monsters.zombie;
    expect(initialMonster.currentHealth).toBe(20);

    let pendingTarget: string | null = null;
    let attackScore: number | null = null;
    const microgame = renderHook(() => useMicrogame((score) => {
      attackScore = score;
      if (pendingTarget) result.current.attackMonster(pendingTarget, score);
      pendingTarget = null;
    }));
    const overlay = renderHook(() => {
      const [visible, setVisible] = React.useState(false);
      return { visible, setVisible };
    });
    const startAttackMicrogame = jest.fn((actor: RoomSceneActor) => {
      if (actor.kind === "enemy") {
        pendingTarget = actor.id;
        act(() => microgame.result.current.start("timed-attack"));
        act(() => overlay.result.current.setVisible(true));
      }
    });
    let currentActor = result.current.roomSceneActors.find((actor) => actor.id === "zombie")!;
    const onActorPress = jest.fn(startAttackMicrogame);
    const renderScreen = () => (
      <ThemeProvider appearance="dark">
        <>
          <GameViewPanel onActorPress={onActorPress} roomSceneActors={[currentActor]} />
          <MicrogameOverlay
            elapsedStore={microgame.result.current.elapsedStore}
            isTest={microgame.result.current.istest}
            kind={microgame.result.current.kind}
            leftHanded={false}
            onTap={microgame.result.current.tap}
            targetDelay={microgame.result.current.targetDelay}
            targetSpot={microgame.result.current.targetSpot}
            visible={overlay.result.current.visible}
          />
        </>
      </ThemeProvider>
    );
    const screen = render(renderScreen());

    expect(screen.getByTestId("enemy-health-bar-fill").props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ width: "100%" })]),
    );

    act(() => fireEvent.press(screen.getByRole("button", { name: "Zombie" })));
    expect(onActorPress).toHaveBeenCalledWith(expect.objectContaining({ id: "zombie", kind: "enemy" }));
    screen.rerender(renderScreen());
    expect(screen.getByTestId("microgame-overlay")).toBeTruthy();

    // Timed attacks score 50 when the mocked tap lands 500 ms after NOW! appears.
    now += microgame.result.current.targetDelay + 500;
    screen.rerender(renderScreen());
    fireEvent.press(screen.getByRole("button", { name: "Tap the game screen" }));
    expect(attackScore).toBe(50);
    expect(getTimedAttackScore(500)).toBe(attackScore);

    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current.dungeonMap.entities.monsters.zombie.currentHealth).toBe(15);
    currentActor = result.current.roomSceneActors.find((actor) => actor.id === "zombie")!;
    expect(currentActor.currentHealth).toBe(15);
    expect(currentActor.maxHealth).toBe(20);
    screen.rerender(renderScreen());
    expect(screen.getByTestId("enemy-health-bar-fill").props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ width: "75%" })]),
    );

    const continuedActors = getRoomSceneActors({
      currentMonsterId: "zombie",
      dungeonMap: result.current.dungeonMap,
      room: getRoom(result.current.dungeonMap, "A1"),
    });
    expect(continuedActors.find((actor) => actor.id === "zombie")).toMatchObject({
      currentHealth: 15,
      isActive: true,
      maxHealth: 20,
    });
  } finally {
    jest.restoreAllMocks();
  }
});
