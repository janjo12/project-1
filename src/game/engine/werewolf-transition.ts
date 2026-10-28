import { getGridPosition } from "@/game/dungeon/types";
import type { EntryPosition } from "@/components/Dungeon/RoomEntryAnimation";

/** Returns the side from which the werewolf should enter its new room. */
export function getWerewolfEntryPosition(fromRoomId: string, toRoomId: string): EntryPosition {
  const from = getGridPosition(fromRoomId);
  const to = getGridPosition(toRoomId);
  const rowDelta = to.row - from.row;
  const columnDelta = to.column.charCodeAt(0) - from.column.charCodeAt(0);

  if (Math.abs(rowDelta) >= Math.abs(columnDelta) && rowDelta !== 0) {
    return rowDelta > 0 ? "left" : "right";
  }
  if (columnDelta !== 0) return columnDelta > 0 ? "top" : "bottom";
  return "top";
}
