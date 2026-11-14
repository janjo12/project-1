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
  "warrior_graphic", "cleric_graphic", "thief_graphic", "archer_graphic", "wizard_graphic", "ghost_graphic",
  "zombie_graphic", "vampire_graphic", "werewolf_graphic",
]);

export function getActorSpriteSize(sprite: string) {
  return HUMAN_FORM_SPRITES.has(sprite) ? HUMAN_FORM_SPRITE_SIZE : CREATURE_SPRITE_SIZE;
}
// Includes attack travel, bounce, and health-bar space.
export const ACTOR_ENVELOPE = 80;
export type SceneSlot = { x: number; y: number; size: number };

export function layoutRoomActors(actors: { id: string; position?: ScenePosition }[]) {
  // Actors occupy non-overlapping 3x3 grid blocks. Dense rooms step down to 2x2
  // or 1x1 blocks while keeping every placement aligned to the same invisible grid.
  const slots: Record<string, SceneSlot> = {};
  const blockSpan = actors.length <= 12 ? 3 : actors.length <= 24 ? 2 : 1;
  const blockSize = blockSpan * SPRITE_SIZE;
  const spriteSize = Math.min(ACTOR_ENVELOPE, blockSize);
  const cells: { column: number; row: number }[] = [];
  for (let row = 0; row + blockSpan <= ROOM_GRID_ROWS; row += blockSpan) {
    for (let column = 0; column + blockSpan <= ROOM_GRID_COLUMNS; column += blockSpan) {
      cells.push({ column, row });
    }
  }
  const centerColumn = (ROOM_GRID_COLUMNS - blockSpan) / 2;
  const centerRow = (ROOM_GRID_ROWS - blockSpan) / 2;
  const regionOrder = (position: ScenePosition, a: typeof cells[number], b: typeof cells[number]) => {
    if (position === "top" && a.row !== b.row) return a.row - b.row;
    if (position === "bottom" && a.row !== b.row) return b.row - a.row;
    if (position === "left" && a.column !== b.column) return a.column - b.column;
    if (position === "right" && a.column !== b.column) return b.column - a.column;
    const aDistance = Math.abs(a.column - centerColumn) + Math.abs(a.row - centerRow);
    const bDistance = Math.abs(b.column - centerColumn) + Math.abs(b.row - centerRow);
    return aDistance - bDistance || a.row - b.row || a.column - b.column;
  };
  const occupied = new Set<string>();
  for (const position of ["center", "top", "bottom", "left", "right"] as const) {
    const group = actors.filter(actor => (actor.position ?? "center") === position)
      .sort((a, b) => a.id.localeCompare(b.id));
    if (!group.length) continue;
    const orderedCells = [...cells].sort((a, b) => regionOrder(position, a, b));
    for (const actor of group) {
      const cell = orderedCells.find(candidate => !occupied.has(`${candidate.column}:${candidate.row}`))
        ?? cells.find(candidate => !occupied.has(`${candidate.column}:${candidate.row}`));
      if (!cell) break;
      occupied.add(`${cell.column}:${cell.row}`);
      slots[actor.id] = {
        x: cell.column * SPRITE_SIZE + (blockSize - spriteSize) / 2,
        y: cell.row * SPRITE_SIZE + (blockSize - spriteSize) / 2,
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


