import type { WorldMonster } from "@/game/entities/enemies";
import { GAME_PARAMETERS } from "@/game/config/gameparameters";

export function getPlayerAttackDamage(target: WorldMonster, charged: boolean): number {
  if (target.chases) return 0;
  return charged ? GAME_PARAMETERS.combat.strongAttackDamage : GAME_PARAMETERS.combat.normalAttackDamage;
}

export function applyDefense(damage: number, defense: number): number {
  return Math.max(0, damage - defense);
}

export function resolveAttackDamage(attack: {
  profile: number;
  score: number;
  equipmentAttack?: number;
  charged?: boolean;
  target: WorldMonster;
}): number {
  return Math.min(attack.target.currentHealth, getPotentialAttackDamage(attack));
}

export function getPotentialAttackDamage({
  profile,
  score,
  equipmentAttack = 0,
  charged = false,
  target,
}: {
  profile: number;
  score: number;
  equipmentAttack?: number;
  charged?: boolean;
  target: WorldMonster;
}): number {
  if (target.chases) return 0;
  const boundedScore = Math.max(0, Math.min(100, Math.round(score)));
  const raw = Math.max(1, Math.floor(profile * boundedScore / 100)) + equipmentAttack + (charged ? 5 : 0);
  return Math.max(0, raw - (target.defense ?? 0));
}

export function resolveEnemyDamage(damage: number, defense: number): number {
  return applyDefense(damage, defense);
}
