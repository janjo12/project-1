import { GAME_PARAMETERS } from "@/game/config/gameparameters";

const IDLE_BOB = Object.freeze({
  from: { transform: [{ translateY: -GAME_PARAMETERS.animation.bounceDistance }] },
  to: { transform: [{ translateY: GAME_PARAMETERS.animation.bounceDistance }] },
});

export function getIdleBobStyle(paused = false, reducedMotion = false) {
  if (reducedMotion) return null;

  return {
    animationName: IDLE_BOB,
    animationDuration: `${GAME_PARAMETERS.animation.bounceDurationMs / 2}ms`,
    animationDirection: "alternate" as const,
    animationIterationCount: "infinite" as const,
    animationTimingFunction: "ease-in-out" as const,
    animationPlayState: paused ? "paused" as const : "running" as const,
  };
}
