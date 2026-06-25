import {
  getActiveRooms,
  moveWerewolfToRoom,
  type DungeonMap,
} from "@/utils/dungeon-map";
import type { Difficulty } from "@/utils/settings-storage";

export const HARD_TURN_LIMIT = 30;
export const TURN_DURATION = 6000;

export function getHardTurnLimit({
  difficulty,
  map,
}: {
  difficulty: Difficulty;
  map: DungeonMap;
}) {
  if (difficulty !== "hard") {
    return HARD_TURN_LIMIT;
  }

  return Math.max(1, getActiveRooms(map).length * 3);
}

export function getTurnDuration({
  difficulty,
  level,
}: {
  difficulty: Difficulty;
  level: number;
}) {
  const startingDuration = difficulty === "hard" ? 5000 : TURN_DURATION;

  return Math.max(2000, startingDuration - (level - 1) * 30);
}

export function applyWerewolfChaseAfterAction({
  hasEncounteredWerewolf,
  map,
  roomId,
}: {
  hasEncounteredWerewolf: boolean;
  map: DungeonMap;
  roomId: string;
}) {
  return hasEncounteredWerewolf ? moveWerewolfToRoom(map, roomId) : map;
}
