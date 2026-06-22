export const COMBAT_ANIMATION = { // in milliseconds
  attackDuration: 500,
  bounceDistance: 10,
  bounceDuration: 1400,
  damageDuration: 248,
  resourceLossDuration: 680,
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

export function createCombatAnimationFrame(): CombatAnimationFrame { // this is used to create a new animation frame with all elapsed times set to 0 or null
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
) { // this is used to advance the elapsed time of an animation frame by a given delta, and return null if the animation has completed
  if (elapsed === null) {
    return null;
  }

  const nextElapsed = elapsed + delta;

  if (nextElapsed >= duration) {
    return null;
  }

  return nextElapsed;
}

export function advanceAnimationFrame(
  frame: CombatAnimationFrame,
  delta: number,
): CombatAnimationFrame { // this is used to advance the elapsed time of an animation frame by a given delta, and return a new animation frame with the updated elapsed times
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
