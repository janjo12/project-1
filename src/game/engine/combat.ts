import type { WorldMonster } from "@/game/entities/enemies";
import { GAME_PARAMETERS } from "@/game/config/gameparameters";
import type { Difficulty } from "@/utils/settings-storage";
import type { GameClassId } from "@/game/config/game-classes";

/** Turns raw minigame performance into a combat result, with a difficulty-wide damage bonus. */
export function scaleMicrogameScore(score: number, difficulty: Difficulty = "hard"): number {
  const bounded = Math.max(0, score);
  const standardScore = Math.min(100, bounded);
  const scaled = difficulty === "easy"
    ? Math.min(100, 75 + standardScore * 0.625)
    : difficulty === "normal"
      ? 25 + standardScore * 0.75
      : bounded;
  // Multitap scores above 100 retain their existing bonus damage on every setting.
  return scaled * 1.1 + Math.max(0, bounded - 100);
}

/** Easy-mode defense stays forgiving but starts from a lower guaranteed reduction. */
export function scaleDefenseMicrogameScore(score: number, difficulty: Difficulty = "hard"): number {
  if (difficulty !== "easy") return scaleMicrogameScore(score, difficulty);
  const bounded = Math.max(0, score);
  const standardScore = Math.min(100, bounded);
  return Math.min(100, 65 + standardScore * 0.625) + Math.max(0, bounded - 100);
}

export function getPlayerAttackDamage(target: WorldMonster, charged: boolean, classId?: GameClassId): number {
  if (target.chases) return 0;
  const classBonus = classId === "wizard" ? 3 : 0;
  return (charged ? GAME_PARAMETERS.combat.strongAttackDamage : GAME_PARAMETERS.combat.normalAttackDamage) + classBonus;
}

/** Vanguard reflects ordinary enemy attacks, but never bypasses Werewolf immunity. */
export function getWarriorRiposteDamage(target: WorldMonster, requestedDamage: number): number {
  if (target.chases) return 0;
  return Math.min(target.currentHealth, Math.max(0, requestedDamage));
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
