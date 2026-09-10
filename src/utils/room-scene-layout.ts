/** Logical world coordinates, independent of screen pixels and artwork. */
export type ScenePosition = "top" | "bottom" | "left" | "right" | "center";
export const SCENE_WIDTH = 384;
export const SCENE_HEIGHT = 240;
export const SPRITE_SIZE = 32;
// Includes attack travel, bounce, and health-bar space.
export const ACTOR_ENVELOPE = 64;
export type SceneSlot = { x: number; y: number; size: number };

export function layoutRoomActors(actors: { id: string; position?: ScenePosition }[]) {
  const slots: Record<string, SceneSlot> = {};
  const regions: Record<ScenePosition, [number, number, number, number]> = {
    top: [16, 8, 352, 64], bottom: [16, 168, 352, 64],
    left: [8, 80, 64, 80], center: [80, 80, 224, 80], right: [312, 80, 64, 80],
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
      if (candidate > size) { columns = count; size = candidate; }
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
