import type { WorldMonster } from "@/game/entities/enemies";

export function getPlayerAttackDamage(target: WorldMonster, charged: boolean): number {
  return target.chases ? (charged ? 15 : 10) : (charged ? 20 : 10);
}

export function applyDefense(damage: number, defense: number): number {
  return Math.max(0, damage - defense);
}

export function resolveAttackDamage({
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
  const boundedScore = Math.max(0, Math.min(100, Math.round(score)));
  const raw = Math.max(1, Math.floor(profile * boundedScore / 100)) + equipmentAttack + (charged ? 5 : 0);
  return Math.min(target.currentHealth, Math.max(0, raw - (target.defense ?? 0)));
}

export function resolveEnemyDamage(damage: number, defense: number): number {
  return applyDefense(damage, defense);
}
