/** Logical world coordinates, independent of screen pixels and artwork. */
export type ScenePosition = "top" | "bottom" | "left" | "right" | "center";
export const SCENE_WIDTH = 384;
export const SCENE_HEIGHT = 288;
export const SPRITE_SIZE = 32;
// Tune this once to resize the player and other human-form sprites together.
export const HUMAN_FORM_SPRITE_SIZE = 56;
export const CREATURE_SPRITE_SIZE = 48;
const HUMAN_FORM_SPRITES = new Set([
  "warrior_graphic", "cleric_graphic", "thief_graphic",
  "zombie_graphic", "vampire_graphic", "werewolf_graphic",
]);

export function getActorSpriteSize(sprite: string) {
  return HUMAN_FORM_SPRITES.has(sprite) ? HUMAN_FORM_SPRITE_SIZE : CREATURE_SPRITE_SIZE;
}
// Includes attack travel, bounce, and health-bar space.
export const ACTOR_ENVELOPE = 80;
export type SceneSlot = { x: number; y: number; size: number };

export function layoutRoomActors(actors: { id: string; position?: ScenePosition }[]) {
  // Pack each actor group into its own logical scene region, independent of device pixel size.
  const slots: Record<string, SceneSlot> = {};
  const regions: Record<ScenePosition, [number, number, number, number]> = {
    top: [16, 8, 352, 50], bottom: [16, 230, 352, 50],
    left: [8, 64, 72, 160], center: [80, 64, 224, 160], right: [304, 64, 72, 160],
  };
  for (const position of Object.keys(regions) as ScenePosition[]) {
    const group = actors.filter(actor => (actor.position ?? "center") === position)
      .sort((a, b) => a.id.localeCompare(b.id));
    if (!group.length) continue;
    const [x, y, width, height] = regions[position];
    let columns = 1;
    let size = 0;
    for (let count = 1; count <= group.length; count++) {
      const candidate = Math.min(ACTOR_ENVELOPE, width / count, height / Math.ceil(group.length / count));
      // Prefer a wider row when equally sized cells fit, which keeps small groups readable.
      if (candidate >= size) { columns = count; size = candidate; }
    }
    const rows = Math.ceil(group.length / columns);
    group.forEach((actor, index) => {
      const row = Math.floor(index / columns);
      const rowCount = Math.min(columns, group.length - row * columns);
      slots[actor.id] = {
        x: x + (width - rowCount * size) / 2 + (index % columns) * size,
        y: y + (height - rows * size) / 2 + row * size,
        size,
      };
    });
  }
  return slots;
}

/** Keep human-form sprites the same size when their actors move between room regions. */
export function getHumanFormScale(playerCount: number) {
  const count = Math.max(1, Math.floor(playerCount));
  const players = Array.from({ length: count }, (_, index) => ({
    id: `human-player-${index}`,
    position: "center" as const,
  }));
  const slots = layoutRoomActors(players);
  return Math.min(1, slots["human-player-0"].size / HUMAN_FORM_SPRITE_SIZE);
}


