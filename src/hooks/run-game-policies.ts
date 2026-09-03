import {
  type DungeonMap,
} from "@/utils/dungeon-map";
import { getActiveRooms, moveWerewolfToRoom } from "@/utils/dungeon-map-runtime";
import type { Difficulty } from "@/utils/settings-storage";
import { GAME_PARAMETERS } from "@/gameparameters";

export const HARD_TURN_LIMIT = GAME_PARAMETERS.turn.hardFallbackLimit;
export const TURN_DURATION = GAME_PARAMETERS.turn.normalBaseDurationMs;

export function hasTurnLimit(difficulty: Difficulty) {
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

export function getEnemyAttackOutcome({
  isDefending,
  monsterDamage,
}: {
  isDefending: boolean;
  monsterDamage: number;
}) {
  return {
    counterattackDamage: isDefending
      ? GAME_PARAMETERS.combat.counterattackDamage
      : 0,
    damageTaken: isDefending
      ? Math.ceil(
          monsterDamage * GAME_PARAMETERS.combat.defendDamageMultiplier,
        )
      : monsterDamage,
  };
}
