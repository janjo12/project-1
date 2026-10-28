import type { WorldMonster } from "@/game/entities/enemies";
import { GAME_PARAMETERS } from "@/game/config/gameparameters";
import type { Difficulty } from "@/utils/settings-storage";
import type { GameClassId } from "@/game/config/game-classes";

/** Turns raw minigame performance into a combat result; hard preserves the current scoring curve. */
export function scaleMicrogameScore(score: number, difficulty: Difficulty = "hard"): number {
  const bounded = Math.max(0, score);
  if (difficulty === "hard") return bounded;
  const standardScore = Math.min(100, bounded);
  const scaled = difficulty === "easy"
    ? Math.min(100, 75 + standardScore * 0.625)
    : 25 + standardScore * 0.75;
  // Multitap scores above 100 retain their existing bonus damage on every setting.
  return scaled + Math.max(0, bounded - 100);
}

export function getPlayerAttackDamage(target: WorldMonster, charged: boolean, classId?: GameClassId): number {
  if (target.chases) return 0;
  const classBonus = classId === "wizard" ? 3 : 0;
  return (charged ? GAME_PARAMETERS.combat.strongAttackDamage : GAME_PARAMETERS.combat.normalAttackDamage) + classBonus;
}

export function applyDefense(damage: number, defense: number): number {
  return Math.max(0, damage - defense);
}

export function resolveAttackDamage(attack: {
  profile: number;
  score: number;
  equipmentAttack?: number;
  charged?: boolean;
  difficulty?: Difficulty;
  target: WorldMonster;
}): number {
  return Math.min(attack.target.currentHealth, getPotentialAttackDamage(attack));
}

export function getPotentialAttackDamage({
  profile,
  score,
  equipmentAttack = 0,
  charged = false,
  difficulty = "hard",
  target,
}: {
  profile: number;
  score: number;
  equipmentAttack?: number;
  charged?: boolean;
  difficulty?: Difficulty;
  target: WorldMonster;
}): number {
  if (target.chases) return 0;
  const boundedScore = Math.max(0, Math.round(scaleMicrogameScore(score, difficulty)));
  const raw = Math.max(1, Math.floor(profile * boundedScore / 100)) + equipmentAttack + (charged ? 5 : 0);
  return Math.max(0, raw - (target.defense ?? 0));
}

export function resolveEnemyDamage(damage: number, defense: number): number {
  return applyDefense(damage, defense);
}
