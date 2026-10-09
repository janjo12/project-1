import { GAME_PARAMETERS } from "@/game/config/gameparameters";
import type { WorldMonster } from "@/game/dungeon/types";

export function getPlayerAttackDamage(monster: WorldMonster, hasEnergy: boolean) {
  // A werewolf is especially dangerous, but charged attacks still benefit from the normal combat bonus.
  if (monster.chases) return GAME_PARAMETERS.player.attack + (hasEnergy ? 5 : 0);
  return hasEnergy ? GAME_PARAMETERS.combat.strongAttackDamage : GAME_PARAMETERS.combat.normalAttackDamage;
}

export function applyDefense(damage: number, defense = 0) {
  // Clamp at zero so stacked armor or class bonuses never turn a hit into healing.
  return Math.max(0, damage - defense);
}

export const getActualDamage = applyDefense;
