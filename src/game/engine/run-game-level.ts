import { getHardTurnLimit, getTurnDuration } from "@/game/engine/resolveTurn";
import { createSeededDungeonMap } from "@/game/dungeon/generateDungeon";
import type { GridPosition } from "@/game/dungeon/types";
import type { Difficulty } from "@/utils/settings-storage";
import { getPlayerAttackDamage } from "@/game/engine/combat";

export function createLevelMap(seed: string, level: number, startingPosition?: GridPosition, includeClock = false) {
  return createSeededDungeonMap(seed, level, startingPosition, includeClock);
}

export { getPlayerAttackDamage };

export { applyDefense as getActualDamage } from "@/game/engine/combat";

export function getNextLevelState({
  clearedLevels, difficulty, level, seed, startingPosition,
}: {
  clearedLevels: number; difficulty: Difficulty; level: number; seed: string; startingPosition?: GridPosition;
}) {
  const nextClearedLevels = clearedLevels + 1;
  const nextLevel = level + 1;
  const nextMap = createLevelMap(seed, nextLevel, startingPosition, difficulty !== "easy");
  return {
    nextClearedLevels, nextLevel, nextMap,
    nextTurnCounter: getHardTurnLimit({ difficulty, map: nextMap }),
    nextTurnDuration: getTurnDuration({ difficulty, level: nextLevel }),
  };
}
