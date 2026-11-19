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
import { DOORWAY_ARROW_BOB_DISTANCE, DOORWAY_ARROW_EDGE_OFFSET, DOORWAY_ARROW_SIZE, getDoorwayArrowEdgeOffset } from "@/components/Dungeon/DoorwayArrow";

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
    expect(Number.isFinite(slot.x)).toBe(true);
    expect(Number.isFinite(slot.y)).toBe(true);
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
  expect(placed["north-guard"].y).toBe(64);
  expect(placed["south-guard"].y).toBe(SCENE_HEIGHT - 64 - ACTOR_ENVELOPE);
  expect(placed["west-guard"].x).toBe(64);
  expect(placed["east-guard"].x).toBe(SCENE_WIDTH - 64 - ACTOR_ENVELOPE);
});

test("a lone player occupies the exact center of the room", () => {
  expect(layoutRoomActors([{ id: "player", position: "center" }]).player).toEqual({
    x: (SCENE_WIDTH - ACTOR_ENVELOPE) / 2,
    y: (SCENE_HEIGHT - ACTOR_ENVELOPE) / 2,
    size: ACTOR_ENVELOPE,
  });
});

test.each(["top", "right", "bottom", "left"] as const)(
  "places a side actor beside and centered on the %s doorway at every crowding level",
  position => {
    for (const actorCount of [2, 13, 25]) {
      const actors = [
        ...Array.from({ length: actorCount - 1 }, (_, index) => ({ id: `center-${index}`, position: "center" as const })),
        { id: `guard-${position}`, position },
      ];
      const slotSize = actorCount <= 12 ? ACTOR_ENVELOPE : actorCount <= 24 ? 2 * SPRITE_SIZE : SPRITE_SIZE;
      const expected = position === "top"
        ? { x: (SCENE_WIDTH - ACTOR_ENVELOPE) / 2, y: 64 }
        : position === "right"
          ? { x: SCENE_WIDTH - 64 - ACTOR_ENVELOPE, y: (SCENE_HEIGHT - ACTOR_ENVELOPE) / 2 }
          : position === "bottom"
            ? { x: (SCENE_WIDTH - ACTOR_ENVELOPE) / 2, y: SCENE_HEIGHT - 64 - ACTOR_ENVELOPE }
            : { x: 64, y: (SCENE_HEIGHT - ACTOR_ENVELOPE) / 2 };
      const slots = layoutRoomActors(actors, ["top", "right", "bottom", "left"]);
      const guardSlot = slots[`guard-${position}`];

      expect(guardSlot).toEqual({ ...expected, size: slotSize });
      if (position === "top" || position === "bottom") {
        expect(guardSlot.x + ACTOR_ENVELOPE / 2).toBe(SCENE_WIDTH / 2);
      } else {
        expect(guardSlot.y + ACTOR_ENVELOPE / 2).toBe(SCENE_HEIGHT / 2);
      }
    }
  },
);

test.each(["top", "right", "bottom", "left"] as const)(
  "keeps the %s movement arrow near the edge and clear of every player click target, including its bob",
  arrowPosition => {
    const arrowCenters = {
      top: { x: SCENE_WIDTH / 2, y: 32 },
      right: { x: SCENE_WIDTH - 32, y: SCENE_HEIGHT / 2 },
      bottom: { x: SCENE_WIDTH / 2, y: SCENE_HEIGHT - 32 },
      left: { x: 32, y: SCENE_HEIGHT / 2 },
    };
    const offset = getDoorwayArrowEdgeOffset(arrowPosition).transform?.[0] as { translateX?: number; translateY?: number };
    const dx = offset.translateX ?? 0;
    const dy = offset.translateY ?? 0;
    const arrowCenter = arrowCenters[arrowPosition];
    expect(arrowPosition === "top" || arrowPosition === "bottom" ? dy : dx).toBe(
      arrowPosition === "top" || arrowPosition === "left" ? -DOORWAY_ARROW_EDGE_OFFSET : DOORWAY_ARROW_EDGE_OFFSET,
    );

    for (const playerPosition of ["top", "right", "bottom", "left", "center"] as const) {
      const player = layoutRoomActors([{ id: "player", position: playerPosition }]).player;
      const arrow = {
        left: arrowCenter.x + dx - DOORWAY_ARROW_SIZE / 2 - DOORWAY_ARROW_BOB_DISTANCE,
        right: arrowCenter.x + dx + DOORWAY_ARROW_SIZE / 2 + DOORWAY_ARROW_BOB_DISTANCE,
        top: arrowCenter.y + dy - DOORWAY_ARROW_SIZE / 2 - DOORWAY_ARROW_BOB_DISTANCE,
        bottom: arrowCenter.y + dy + DOORWAY_ARROW_SIZE / 2 + DOORWAY_ARROW_BOB_DISTANCE,
      };
      const overlapsPlayerTarget = arrow.left < player.x + ACTOR_ENVELOPE && player.x < arrow.right
        && arrow.top < player.y + ACTOR_ENVELOPE && player.y < arrow.bottom;
      expect(overlapsPlayerTarget).toBe(false);
    }
  },
);

test.each(["top", "right", "bottom", "left"] as const)(
  "places a %s doorway guard at the doorway arrow position at every crowding level",
  position => {
    const arrowCenters = {
      top: { x: SCENE_WIDTH / 2, y: 32 },
      right: { x: SCENE_WIDTH - 32, y: SCENE_HEIGHT / 2 },
      bottom: { x: SCENE_WIDTH / 2, y: SCENE_HEIGHT - 32 },
      left: { x: 32, y: SCENE_HEIGHT / 2 },
    };
    for (const actorCount of [2, 13, 25]) {
      const actors = [
        ...Array.from({ length: actorCount - 1 }, (_, index) => ({ id: `center-${index}`, position: "center" as const })),
        { id: `guard-${position}`, position, isDoorwayGuard: true },
      ];
      const slotSize = actorCount <= 12 ? ACTOR_ENVELOPE : actorCount <= 24 ? 2 * SPRITE_SIZE : SPRITE_SIZE;
      const slots = layoutRoomActors(actors, ["top", "right", "bottom", "left"]);
      const guardSlot = slots[`guard-${position}`];
      const center = { x: guardSlot.x + ACTOR_ENVELOPE / 2, y: guardSlot.y + ACTOR_ENVELOPE / 2 };

      expect(guardSlot.size).toBe(slotSize);
      expect(center).toEqual(arrowCenters[position]);
      expect(Math.abs(center.x - arrowCenters[position].x) + Math.abs(center.y - arrowCenters[position].y)).toBe(0);
    }
  },
);

test("grid placement is deterministic regardless of actor input order", () => {
  const actors = [
    { id: "player", position: "center" as const },
    { id: "zombie", position: "center" as const },
    { id: "stairs", position: "center" as const },
    { id: "north-guard", position: "top" as const },
  ];
  expect(layoutRoomActors(actors)).toEqual(layoutRoomActors([...actors].reverse()));
});

test("doorway hit targets do not overlap actor sprites or clickable envelopes", () => {
  const activeDoorways = ["top", "right", "bottom", "left"] as const;
  const actors = [
    { id: "player", position: "center" as const },
    { id: "north-enemy", position: "top" as const },
    { id: "south-item", position: "bottom" as const },
    { id: "west-equipment", position: "left" as const },
    { id: "east-stairs", position: "right" as const },
  ];
  const slots = layoutRoomActors(actors, [...activeDoorways]);
  const doorwayBounds = {
    top: { left: (SCENE_WIDTH - 64) / 2, top: 0, right: (SCENE_WIDTH + 64) / 2, bottom: 64 },
    right: { left: SCENE_WIDTH - 64, top: (SCENE_HEIGHT - 64) / 2, right: SCENE_WIDTH, bottom: (SCENE_HEIGHT + 64) / 2 },
    bottom: { left: (SCENE_WIDTH - 64) / 2, top: SCENE_HEIGHT - 64, right: (SCENE_WIDTH + 64) / 2, bottom: SCENE_HEIGHT },
    left: { left: 0, top: (SCENE_HEIGHT - 64) / 2, right: 64, bottom: (SCENE_HEIGHT + 64) / 2 },
  };

  expect(Object.keys(slots)).toHaveLength(actors.length);
  for (const slot of Object.values(slots)) {
    for (const doorway of Object.values(doorwayBounds)) {
      const overlaps = slot.x < doorway.right && slot.x + ACTOR_ENVELOPE > doorway.left
        && slot.y < doorway.bottom && slot.y + ACTOR_ENVELOPE > doorway.top;
      expect(overlaps).toBe(false);
    }
  }
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
