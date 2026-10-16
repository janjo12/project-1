import { GAME_PARAMETERS } from "@/game/config/gameparameters";
import { getActiveRooms, moveWerewolfToRoom } from "@/game/dungeon/rooms";
import type { DungeonMap } from "@/game/dungeon/types";
import type { Difficulty } from "@/utils/settings-storage";
import type { ItemId } from "@/game/entities/items";

export const TURN_DURATION = GAME_PARAMETERS.turn.normalBaseDurationMs;
export const HARD_TURN_LIMIT = GAME_PARAMETERS.turn.hardFallbackLimit;
export const hasTurnLimit = (difficulty: Difficulty) => difficulty !== "easy";
export const hasTurnTimer = (difficulty: Difficulty) => difficulty === "hard";

export function getHardTurnLimit({ difficulty, map }: { difficulty: Difficulty; map: DungeonMap }): number {
  return hasTurnLimit(difficulty)
    ? Math.max(1, getActiveRooms(map).length * GAME_PARAMETERS.dungeon.hardTurnsPerRoom)
    : HARD_TURN_LIMIT;
}

export function getTurnDuration({ difficulty, level }: { difficulty: Difficulty; level: number }): number {
  const base = difficulty === "hard" ? GAME_PARAMETERS.turn.hardBaseDurationMs : GAME_PARAMETERS.turn.normalBaseDurationMs;
  return Math.max(GAME_PARAMETERS.turn.minimumDurationMs, base - Math.max(0, level - 1) * GAME_PARAMETERS.turn.durationReductionPerLevelMs);
}

export function resolveTurnLoss(counter: number, item: ItemId | null, level: number) {
  const nextCounter = Math.max(0, counter - 1);
  const usesClock = counter > 0 && nextCounter === 0 && item === "clock";
  return { nextCounter: usesClock ? GAME_PARAMETERS.turn.clockBaseTurns + level : nextCounter, usesClock };
}

export function applyWerewolfChaseAfterAction({ hasEncounteredWerewolf, map, roomId }: { hasEncounteredWerewolf: boolean; map: DungeonMap; roomId: string }): DungeonMap {
  if (!hasEncounteredWerewolf) return map;
  const werewolfAlive = Object.values(map.entities.monsters).some(monster => monster.chases && monster.currentHealth > 0);
  if (!werewolfAlive) return map;
  return moveWerewolfToRoom(map, roomId);
}
