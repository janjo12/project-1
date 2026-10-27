import { render } from "@testing-library/react-native";

import { ThemeProvider } from "@/components/Common/theme";
import { DungeonMap } from "@/components/Dungeon/DungeonMap";
import { createSeededDungeonMap } from "@/game/dungeon/generateDungeon";
import { getNeighborRoom, type Direction } from "@/game/dungeon/types";

const mapDirection: Record<Direction, Direction> = {
  east: "west",
  north: "south",
  south: "north",
  west: "east",
};

function withRevealedRooms(map: ReturnType<typeof createSeededDungeonMap>, revealed: Set<string>) {
  return {
    ...map,
    rooms: map.rooms.map(row => row.map(room => ({ ...room, isRevealed: revealed.has(room.id) }))),
  };
}

test("a revealed doorway draws one hallway half until the neighboring room is revealed", async () => {
  const map = createSeededDungeonMap("map-half-hallway", 1);
  const startingRoom = map.rooms.flat().find(room => room.id === map.startingRoomId)!;
  const direction = (["north", "east", "south", "west"] as const)
    .find(candidate => startingRoom[candidate] === "open"
      && getNeighborRoom(map.rooms, startingRoom.id, candidate) !== null)!;
  const neighbor = getNeighborRoom(map.rooms, startingRoom.id, direction)!;
  const hiddenNeighborMap = withRevealedRooms(map, new Set([startingRoom.id]));
  const screen = await render(
    <ThemeProvider appearance="dark">
      <DungeonMap currentRoomId={startingRoom.id} map={hiddenNeighborMap} />
    </ThemeProvider>,
  );

  expect(screen.getByTestId(`map-corridor-${startingRoom.id}-${direction}`)).toBeTruthy();
  expect(screen.queryByTestId(`map-corridor-${neighbor.id}-${mapDirection[direction]}`)).toBeNull();

  const revealedNeighborMap = withRevealedRooms(map, new Set([startingRoom.id, neighbor.id]));
  await screen.rerender(
    <ThemeProvider appearance="dark">
      <DungeonMap currentRoomId={startingRoom.id} map={revealedNeighborMap} />
    </ThemeProvider>,
  );

  expect(screen.getByTestId(`map-corridor-${startingRoom.id}-${direction}`)).toBeTruthy();
  expect(screen.getByTestId(`map-corridor-${neighbor.id}-${mapDirection[direction]}`)).toBeTruthy();
});

test.each(["locked", "guarded"] as const)("a %s doorway shows its marker without a hallway", async state => {
  const generated = createSeededDungeonMap("map-blocked-hallway", 1);
  const startingRoom = generated.rooms.flat().find(room => room.id === generated.startingRoomId)!;
  const direction = (["north", "east", "south", "west"] as const)
    .find(candidate => startingRoom[candidate] === "open"
      && getNeighborRoom(generated.rooms, startingRoom.id, candidate) !== null)!;
  const blockedMap = {
    ...generated,
    rooms: generated.rooms.map(row => row.map(room => room.id === startingRoom.id
      ? { ...room, [direction]: state, isRevealed: true }
      : { ...room, isRevealed: false })),
  };
  const screen = await render(
    <ThemeProvider appearance="dark">
      <DungeonMap currentRoomId={startingRoom.id} map={blockedMap} />
    </ThemeProvider>,
  );

  expect(screen.queryByTestId(`map-corridor-${startingRoom.id}-${direction}`)).toBeNull();
  expect(screen.getByTestId(state === "locked"
    ? `map-locked-doorway-${startingRoom.id}-${direction === "north" ? "top" : direction === "east" ? "right" : direction === "south" ? "bottom" : "left"}`
    : `map-guarded-doorway-${startingRoom.id}-${direction === "north" ? "top" : direction === "east" ? "right" : direction === "south" ? "bottom" : "left"}`)).toBeTruthy();

  const openMap = {
    ...blockedMap,
    rooms: blockedMap.rooms.map(row => row.map(room => room.id === startingRoom.id
      ? { ...room, [direction]: "open" }
      : room)),
  };
  await screen.rerender(
    <ThemeProvider appearance="dark">
      <DungeonMap currentRoomId={startingRoom.id} map={openMap} />
    </ThemeProvider>,
  );
  expect(screen.getByTestId(`map-corridor-${startingRoom.id}-${direction}`)).toBeTruthy();
});
