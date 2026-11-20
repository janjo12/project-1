/** Logical world coordinates, independent of screen pixels and artwork. */
export type ScenePosition = "top" | "bottom" | "left" | "right" | "center";
export const SCENE_WIDTH = 384;
export const SCENE_HEIGHT = 288;
export const SPRITE_SIZE = 32;
export const ROOM_GRID_COLUMNS = SCENE_WIDTH / SPRITE_SIZE;
export const ROOM_GRID_ROWS = SCENE_HEIGHT / SPRITE_SIZE;
// Tune this once to resize the player and other human-form sprites together.
export const HUMAN_FORM_SPRITE_SIZE = 56;
export const CREATURE_SPRITE_SIZE = 48;
const HUMAN_FORM_SPRITES = new Set([
  "warrior_graphic", "cleric_graphic", "thief_graphic", "archer_graphic", "wizard_graphic", "ghost_graphic", "banshee_graphic",
  "zombie_graphic", "vampire_graphic", "werewolf_graphic",
]);

export function getActorSpriteSize(sprite: string) {
  return HUMAN_FORM_SPRITES.has(sprite) ? HUMAN_FORM_SPRITE_SIZE : CREATURE_SPRITE_SIZE;
}
// Includes attack travel, bounce, and health-bar space.
export const ACTOR_ENVELOPE = 80;
export type SceneSlot = { x: number; y: number; size: number };

export function layoutRoomActors(actors: { id: string; position?: ScenePosition; isDoorwayGuard?: boolean }[], activeDoorways: Exclude<ScenePosition, "center">[] = []) {
  // Actors occupy non-overlapping 3x3 grid blocks. Dense rooms step down to 2x2
  // or 1x1 blocks while keeping every placement aligned to the same invisible grid.
  const slots: Record<string, SceneSlot> = {};
  let blockSpan = actors.length <= 12 ? 3 : actors.length <= 24 ? 2 : 1;
  const doorwayBounds: Record<Exclude<ScenePosition, "center">, { left: number; top: number; right: number; bottom: number }> = {
    top: { left: (SCENE_WIDTH - 64) / 2, top: 0, right: (SCENE_WIDTH + 64) / 2, bottom: 64 },
    right: { left: SCENE_WIDTH - 64, top: (SCENE_HEIGHT - 64) / 2, right: SCENE_WIDTH, bottom: (SCENE_HEIGHT + 64) / 2 },
    bottom: { left: (SCENE_WIDTH - 64) / 2, top: SCENE_HEIGHT - 64, right: (SCENE_WIDTH + 64) / 2, bottom: SCENE_HEIGHT },
    left: { left: 0, top: (SCENE_HEIGHT - 64) / 2, right: 64, bottom: (SCENE_HEIGHT + 64) / 2 },
  };
  const hasDoorwayOverlap = (left: number, top: number) => activeDoorways.some(position => {
    const doorway = doorwayBounds[position];
    return left < doorway.right && left + ACTOR_ENVELOPE > doorway.left
      && top < doorway.bottom && top + ACTOR_ENVELOPE > doorway.top;
  });
  const getCells = (span: number) => {
    const blockSize = span * SPRITE_SIZE;
    const spriteSize = Math.min(ACTOR_ENVELOPE, blockSize);
    const cells: { column: number; row: number }[] = [];
    for (let row = 0; row + span <= ROOM_GRID_ROWS; row += span) {
      for (let column = 0; column + span <= ROOM_GRID_COLUMNS; column += span) {
        const left = column * SPRITE_SIZE + (blockSize - spriteSize) / 2;
        const top = row * SPRITE_SIZE + (blockSize - spriteSize) / 2;
        if (!hasDoorwayOverlap(left, top)) cells.push({ column, row });
      }
    }
    return cells;
  };
  let cells = getCells(blockSpan);
  while (cells.length < actors.length && blockSpan > 1) {
    blockSpan -= 1;
    cells = getCells(blockSpan);
  }
  const blockSize = blockSpan * SPRITE_SIZE;
  const spriteSize = Math.min(ACTOR_ENVELOPE, blockSize);
  const center = { x: (SCENE_WIDTH - spriteSize) / 2, y: (SCENE_HEIGHT - spriteSize) / 2 };
  const sideTargets: Record<Exclude<ScenePosition, "center">, { x: number; y: number }> = {
    top: { x: (SCENE_WIDTH - ACTOR_ENVELOPE) / 2, y: 64 },
    right: { x: SCENE_WIDTH - 64 - ACTOR_ENVELOPE, y: (SCENE_HEIGHT - ACTOR_ENVELOPE) / 2 },
    bottom: { x: (SCENE_WIDTH - ACTOR_ENVELOPE) / 2, y: SCENE_HEIGHT - 64 - ACTOR_ENVELOPE },
    left: { x: 64, y: (SCENE_HEIGHT - ACTOR_ENVELOPE) / 2 },
  };
  const guardTargets: Record<Exclude<ScenePosition, "center">, { x: number; y: number }> = {
    top: { x: (SCENE_WIDTH - ACTOR_ENVELOPE) / 2, y: 32 - ACTOR_ENVELOPE / 2 },
    right: { x: SCENE_WIDTH - 32 - ACTOR_ENVELOPE / 2, y: (SCENE_HEIGHT - ACTOR_ENVELOPE) / 2 },
    bottom: { x: (SCENE_WIDTH - ACTOR_ENVELOPE) / 2, y: SCENE_HEIGHT - 32 - ACTOR_ENVELOPE / 2 },
    left: { x: 32 - ACTOR_ENVELOPE / 2, y: (SCENE_HEIGHT - ACTOR_ENVELOPE) / 2 },
  };
  const candidatePositions = [
    ...cells.map(({ column, row }) => ({
      column,
      row,
      x: column * SPRITE_SIZE + (blockSize - spriteSize) / 2,
      y: row * SPRITE_SIZE + (blockSize - spriteSize) / 2,
    })),
    ...(actors.length <= ROOM_GRID_COLUMNS * 2 ? [{ column: -1, row: -1, ...center }] : []),
    ...(actors.some(actor => actor.position && actor.position !== "center")
      ? Object.values(sideTargets).map(({ x, y }) => ({ column: -1, row: -1, x, y }))
      : []),
    ...(actors.some(actor => actor.isDoorwayGuard)
      ? Object.values(guardTargets).map(({ x, y }) => ({ column: -1, row: -1, x, y }))
      : []),
  ].filter((candidate, index, candidates) =>
    candidates.findIndex(other => other.x === candidate.x && other.y === candidate.y) === index,
  );
  const overlapsDoorway = (candidate: { x: number; y: number }, actorPosition: ScenePosition, isDoorwayGuard: boolean) => activeDoorways.some(position => {
    if (isDoorwayGuard && actorPosition === position) return false;
    const doorway = doorwayBounds[position];
    return candidate.x < doorway.right && candidate.x + ACTOR_ENVELOPE > doorway.left
      && candidate.y < doorway.bottom && candidate.y + ACTOR_ENVELOPE > doorway.top;
  });
  const distanceFromTarget = (actor: { position?: ScenePosition; isDoorwayGuard?: boolean }, candidate: { x: number; y: number }) => {
    const position = actor.position ?? "center";
    const target = position === "center" ? center : actor.isDoorwayGuard ? guardTargets[position] : sideTargets[position];
    return Math.abs(candidate.x - target.x) + Math.abs(candidate.y - target.y);
  };
  const occupied: { x: number; y: number }[] = [];
  // Pin doorway actors to their own side first, then place ordinary actors around the center.
  for (const position of ["top", "right", "bottom", "left", "center"] as const) {
    const group = actors.filter(actor => (actor.position ?? "center") === position)
      .sort((a, b) => a.id.localeCompare(b.id));
    if (!group.length) continue;
    for (const actor of group) {
      const orderedCandidates = [...candidatePositions].sort((a, b) =>
        distanceFromTarget(actor, a) - distanceFromTarget(actor, b)
        || a.y - b.y
        || a.x - b.x,
      );
      const candidate = orderedCandidates.find(slot => {
        if (overlapsDoorway(slot, position, Boolean(actor.isDoorwayGuard))) return false;
        return occupied.every(other => slot.x + spriteSize <= other.x || other.x + spriteSize <= slot.x
          || slot.y + spriteSize <= other.y || other.y + spriteSize <= slot.y);
      });
      if (!candidate) break;
      occupied.push(candidate);
      slots[actor.id] = {
        x: candidate.x,
        y: candidate.y,
        size: spriteSize,
      };
    }
  }
  return slots;
}

/** Keep human-form sprites at a consistent size while their grid block fits the envelope. */
export function getHumanFormScale(playerCount: number) {
  const count = Math.max(1, Math.floor(playerCount));
  const players = Array.from({ length: count }, (_, index) => ({
    id: `human-player-${index}`,
    position: "center" as const,
  }));
  const slots = layoutRoomActors(players);
  return Math.min(1, slots["human-player-0"].size / HUMAN_FORM_SPRITE_SIZE);
}


