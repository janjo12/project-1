import {
  type DungeonMap,
} from "@/game/dungeon/types";
import { getActiveRooms, moveWerewolfToRoom } from "@/game/dungeon/rooms";
import type { Difficulty } from "@/utils/settings-storage";
import type { ItemId } from "@/game/entities/items";
import { GAME_PARAMETERS } from "@/game/config/gameparameters";

export const HARD_TURN_LIMIT = GAME_PARAMETERS.turn.hardFallbackLimit;
export const TURN_DURATION = GAME_PARAMETERS.turn.normalBaseDurationMs;

/** Spend one turn, unless a clock rescues the run at zero and grants a level-scaled extension. */
export function resolveTurnLoss(counter: number, item: ItemId | null, level: number) {
  const remainingTurns = Math.max(0, counter - 1);
  const usesClock = remainingTurns === 0 && item === "clock";
  return { nextCounter: usesClock ? GAME_PARAMETERS.turn.clockBaseTurns + level : remainingTurns, usesClock };
}

export function hasTurnLimit(difficulty: Difficulty) {
  // Easy removes the run-wide deadline; normal and hard share the same turn budget.
  return difficulty !== "easy";
}

export function hasTurnTimer(difficulty: Difficulty) {
  return difficulty === "hard";
}

export function getHardTurnLimit({
  difficulty,
  map,
}: {
  difficulty: Difficulty;
  map: DungeonMap;
}) {
  if (!hasTurnLimit(difficulty)) {
    return HARD_TURN_LIMIT;
  }

  return Math.max(1, getActiveRooms(map).length * GAME_PARAMETERS.dungeon.hardTurnsPerRoom);
}

export function getTurnDuration({
  difficulty,
  level,
}: {
  difficulty: Difficulty;
  level: number;
}) {
  // Hard starts with a shorter action timer, and every level speeds it up to a floor.
  const startingDuration =
    difficulty === "hard"
      ? GAME_PARAMETERS.turn.hardBaseDurationMs
      : TURN_DURATION;

  return Math.max(
    GAME_PARAMETERS.turn.minimumDurationMs,
    startingDuration -
      (level - 1) * GAME_PARAMETERS.turn.durationReductionPerLevelMs,
  );
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
