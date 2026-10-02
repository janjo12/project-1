import { GAME_PARAMETERS } from "@/game/config/gameparameters";
import type { WorldMonster } from "@/game/dungeon/types";

export function getPlayerAttackDamage(monster: WorldMonster, hasEnergy: boolean) {
  // The werewolf ignores ordinary energy scaling; other monsters use the stronger attack when energized.
  if (monster.chases) return GAME_PARAMETERS.player.attack;
  return hasEnergy ? GAME_PARAMETERS.combat.strongAttackDamage : GAME_PARAMETERS.combat.normalAttackDamage;
}

export function applyDefense(damage: number, defense = 0) {
  // Clamp at zero so stacked armor or class bonuses never turn a hit into healing.
  return Math.max(0, damage - defense);
}

export const getActualDamage = applyDefense;
