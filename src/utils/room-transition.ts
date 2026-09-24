export type RoomTransitionDirection = "left" | "right" | "up" | "down";

/** Return the screen direction the incoming room should travel from. */
export function getAdjacentRoomTransition(from: string | undefined, to: string | undefined): RoomTransitionDirection | null {
  if (!from || !to || from === to || from.length < 2 || to.length < 2) return null;
  const fromRow = from.charCodeAt(0) - 65;
  const toRow = to.charCodeAt(0) - 65;
  const fromColumn = Number(from.slice(1));
  const toColumn = Number(to.slice(1));
  if (!Number.isInteger(fromColumn) || !Number.isInteger(toColumn)) return null;
  if (fromRow === toRow && toColumn === fromColumn + 1) return "right";
  if (fromRow === toRow && toColumn === fromColumn - 1) return "left";
  if (fromColumn === toColumn && toRow === fromRow + 1) return "down";
  if (fromColumn === toColumn && toRow === fromRow - 1) return "up";
  return null;
}
