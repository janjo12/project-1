import { GAME_PARAMETERS } from "@/gameparameters";

export {
  advanceAnimationFrame,
  COMBAT_ANIMATION,
  createCombatAnimationFrame
} from "./combat/animations";
export type { CombatAnimationFrame } from "./combat/animations";

export const PLAYER: {
  maxEnergy: number;
  maxHealth: number;
} = {
  maxEnergy: GAME_PARAMETERS.player.maxEnergy,
  maxHealth: GAME_PARAMETERS.player.maxHealth,
};
