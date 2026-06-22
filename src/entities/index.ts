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
  maxEnergy: 6,
  maxHealth: 10,
};
