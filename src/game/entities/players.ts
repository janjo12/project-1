import { GAME_PARAMETERS } from "@/game/config/gameparameters";

export const PLAYER = {
  maxEnergy: GAME_PARAMETERS.player.maxEnergy,
  maxHealth: GAME_PARAMETERS.player.maxHealth,
} as const;
