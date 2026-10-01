import { GAME_PARAMETERS } from "@/game/config/gameparameters";

export const COMBAT_ANIMATION = {
  attackDuration: GAME_PARAMETERS.animation.attackDurationMs,
  damageDuration: GAME_PARAMETERS.animation.damageDurationMs,
  resourceLossDuration: GAME_PARAMETERS.animation.resourceLossDurationMs,
} as const;

export type CombatAnimationFrame = {
  enemyAttackElapsed: number | null;
  enemyDamageElapsed: number | null;
  enemyHealthLossElapsed: number | null;
  playerAttackElapsed: number | null;
  playerDamageElapsed: number | null;
  playerEnergyLossElapsed: number | null;
  playerHealthLossElapsed: number | null;
};

/** Start with every one-shot animation inactive. */
export function createCombatAnimationFrame(): CombatAnimationFrame {
  return {
    enemyAttackElapsed: null,
    enemyDamageElapsed: null,
    enemyHealthLossElapsed: null,
    playerAttackElapsed: null,
    playerDamageElapsed: null,
    playerEnergyLossElapsed: null,
    playerHealthLossElapsed: null,
  };
}

function advanceElapsed(
  elapsed: number | null,
  delta: number,
  duration: number,
) {
  if (elapsed === null) {
    return null;
  }

  const nextElapsed = elapsed + delta;

  if (nextElapsed >= duration) {
    return null;
  }

  return nextElapsed;
}

export function hasActiveCombatAnimation(frame: CombatAnimationFrame) {
  return frame.enemyAttackElapsed !== null ||
    frame.enemyDamageElapsed !== null ||
    frame.enemyHealthLossElapsed !== null ||
    frame.playerAttackElapsed !== null ||
    frame.playerDamageElapsed !== null ||
    frame.playerEnergyLossElapsed !== null ||
    frame.playerHealthLossElapsed !== null;
}

/** Advance every active animation by the same frame delta; completed one-shots return to null. */
export function advanceAnimationFrame(
  frame: CombatAnimationFrame,
  delta: number,
): CombatAnimationFrame {
  if (!hasActiveCombatAnimation(frame)) {
    return frame;
  }

  return {
    enemyAttackElapsed: advanceElapsed(
      frame.enemyAttackElapsed,
      delta,
      COMBAT_ANIMATION.attackDuration,
    ),
    enemyDamageElapsed: advanceElapsed(
      frame.enemyDamageElapsed,
      delta,
      COMBAT_ANIMATION.damageDuration,
    ),
    enemyHealthLossElapsed: advanceElapsed(
      frame.enemyHealthLossElapsed,
      delta,
      COMBAT_ANIMATION.resourceLossDuration,
    ),
    playerAttackElapsed: advanceElapsed(
      frame.playerAttackElapsed,
      delta,
      COMBAT_ANIMATION.attackDuration,
    ),
    playerDamageElapsed: advanceElapsed(
      frame.playerDamageElapsed,
      delta,
      COMBAT_ANIMATION.damageDuration,
    ),
    playerEnergyLossElapsed: advanceElapsed(
      frame.playerEnergyLossElapsed,
      delta,
      COMBAT_ANIMATION.resourceLossDuration,
    ),
    playerHealthLossElapsed: advanceElapsed(
      frame.playerHealthLossElapsed,
      delta,
      COMBAT_ANIMATION.resourceLossDuration,
    ),
  };
}
