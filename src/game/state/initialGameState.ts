import { createLevelMap } from "@/game/engine/run-game-level";
import { getHardTurnLimit, getTurnDuration } from "@/game/engine/resolveTurn";
import { PLAYER_MAX_ENERGY, PLAYER_MAX_HEALTH, type GameState } from "@/game/state/types";
import type { Difficulty } from "@/utils/settings-storage";

export function createInitialGameState({ difficulty, seed }: { difficulty: Difficulty; seed: string }): GameState {
  // A run starts on level one with full resources and difficulty-specific turn/timer limits.
  const level = 1;
  const dungeonMap = createLevelMap(seed, level, undefined, difficulty !== "easy");
  return {
    level,
    clearedLevels: 0,
    dungeonMap,
    inventoryItem: null,
    equipment: null,
    playerEnergy: PLAYER_MAX_ENERGY,
    playerHealth: PLAYER_MAX_HEALTH,
    turnCounter: getHardTurnLimit({ difficulty, map: dungeonMap }),
    turnNumber: 0,
    turnTimeRemaining: getTurnDuration({ difficulty, level }),
  };
}
