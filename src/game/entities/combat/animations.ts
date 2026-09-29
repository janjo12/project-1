import { GAME_PARAMETERS } from "@/game/config/gameparameters";

export const COMBAT_ANIMATION = {
  attackDuration: GAME_PARAMETERS.animation.attackDurationMs,
  bounceDistance: GAME_PARAMETERS.animation.bounceDistance,
  bounceDuration: GAME_PARAMETERS.animation.bounceDurationMs,
  damageDuration: GAME_PARAMETERS.animation.damageDurationMs,
  resourceLossDuration: GAME_PARAMETERS.animation.resourceLossDurationMs,
} as const;

export type CombatAnimationFrame = {
  bounceElapsed: number;
  enemyAttackElapsed: number | null;
  enemyDamageElapsed: number | null;
  enemyHealthLossElapsed: number | null;
  playerAttackElapsed: number | null;
  playerDamageElapsed: number | null;
  playerEnergyLossElapsed: number | null;
  playerHealthLossElapsed: number | null;
};

/** Start with idle bounce at zero and inactive one-shot animations marked null. */
export function createCombatAnimationFrame(): CombatAnimationFrame {
  return {
    bounceElapsed: 0,
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

/** Advance every active animation by the same frame delta; completed one-shots return to null. */
export function advanceAnimationFrame(
  frame: CombatAnimationFrame,
  delta: number,
): CombatAnimationFrame {
  return {
    bounceElapsed:
      (frame.bounceElapsed + delta) % COMBAT_ANIMATION.bounceDuration,
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
