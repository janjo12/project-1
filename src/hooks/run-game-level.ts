import { getHardTurnLimit, getTurnDuration } from "@/hooks/run-game-policies";
import { createSeededDungeonMap } from "@/utils/dungeon-generation";
import type { GridPosition, WorldMonster } from "@/utils/dungeon-map";
import type { Difficulty } from "@/utils/settings-storage";
import { GAME_PARAMETERS } from "@/gameparameters";

export function createLevelMap(seed: string, level: number, startingPosition?: GridPosition, includeClock = false) {
  return createSeededDungeonMap(seed, level, startingPosition, includeClock);
}

export function getPlayerAttackDamage(monster: WorldMonster, hasEnergy: boolean) {
  if (monster.chases) return GAME_PARAMETERS.player.attack;
  return hasEnergy ? GAME_PARAMETERS.combat.strongAttackDamage : GAME_PARAMETERS.combat.normalAttackDamage;
}

export function getActualDamage(attack: number, defense = 0) { return Math.max(0, attack - defense); }

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
