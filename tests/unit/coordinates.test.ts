import {
  ACTOR_ENVELOPE,
  ROOM_GRID_COLUMNS,
  ROOM_GRID_ROWS,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  SPRITE_SIZE,
  getHumanFormScale,
  layoutRoomActors,
  type ScenePosition,
} from "@/utils/coordinates";

test("room dimensions define an exact invisible sprite grid", () => {
  expect(ROOM_GRID_COLUMNS * SPRITE_SIZE).toBe(SCENE_WIDTH);
  expect(ROOM_GRID_ROWS * SPRITE_SIZE).toBe(SCENE_HEIGHT);
});

test("sprites use unique grid blocks and stay inside the room at every preferred position", () => {
  const actors: { id: string; position: ScenePosition }[] = [
    { id: "player", position: "center" },
    { id: "enemy", position: "center" },
    { id: "north-guard", position: "top" },
    { id: "south-guard", position: "bottom" },
    { id: "west-guard", position: "left" },
    { id: "east-guard", position: "right" },
  ];
  const slots = Object.values(layoutRoomActors(actors));

  expect(slots).toHaveLength(actors.length);
  expect(new Set(slots.map(slot => `${slot.x}:${slot.y}`)).size).toBe(actors.length);
  for (const slot of slots) {
    expect(slot.size).toBe(ACTOR_ENVELOPE);
    expect(slot.x % SPRITE_SIZE).toBe(8);
    expect(slot.y % SPRITE_SIZE).toBe(8);
    expect(slot.x + slot.size).toBeLessThanOrEqual(SCENE_WIDTH);
    expect(slot.y + slot.size).toBeLessThanOrEqual(SCENE_HEIGHT);
  }
  for (let index = 0; index < slots.length; index += 1) {
    for (const other of slots.slice(index + 1)) {
      expect(slots[index].x + slots[index].size <= other.x || other.x + other.size <= slots[index].x ||
        slots[index].y + slots[index].size <= other.y || other.y + other.size <= slots[index].y).toBe(true);
    }
  }

  const placed = layoutRoomActors(actors);
  expect(placed["north-guard"].y).toBeLessThan(placed.player.y);
  expect(placed["south-guard"].y).toBeGreaterThan(placed.player.y);
  expect(placed["west-guard"].x).toBeLessThan(placed.player.x);
  expect(placed["east-guard"].x).toBeGreaterThan(placed.player.x);
});

test("grid placement is deterministic regardless of actor input order", () => {
  const actors = [
    { id: "player", position: "center" as const },
    { id: "zombie", position: "center" as const },
    { id: "stairs", position: "center" as const },
    { id: "north-guard", position: "top" as const },
  ];
  expect(layoutRoomActors(actors)).toEqual(layoutRoomActors([...actors].reverse()));
});

test("crowded rooms scale down by grid block size without overlapping placements", () => {
  const denseActors = Array.from({ length: 13 }, (_, index) => ({ id: `actor-${index}`, position: "center" as const }));
  const denseSlots = Object.values(layoutRoomActors(denseActors));
  expect(denseSlots).toHaveLength(denseActors.length);
  expect(denseSlots.every(slot => slot.size === 2 * SPRITE_SIZE)).toBe(true);
  expect(new Set(denseSlots.map(slot => `${slot.x}:${slot.y}`)).size).toBe(denseSlots.length);

  const maximumActors = Array.from({ length: ROOM_GRID_COLUMNS * ROOM_GRID_ROWS }, (_, index) => ({ id: `actor-${index}`, position: "center" as const }));
  const smallSlots = Object.values(layoutRoomActors(maximumActors));
  expect(smallSlots).toHaveLength(maximumActors.length);
  expect(smallSlots.every(slot => slot.size === SPRITE_SIZE)).toBe(true);
  expect(new Set(smallSlots.map(slot => `${slot.x}:${slot.y}`)).size).toBe(smallSlots.length);
});

test("human-form sprites stay full size while their grid blocks fit", () => {
  expect(getHumanFormScale(1)).toBe(1);
  expect(getHumanFormScale(8)).toBe(1);
});
