import { PixelSprite } from "@/components/Common/PixelSprite";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { GAME_PARAMETERS } from "@/game/config/gameparameters";

const IDLE_BOB = {
  from: { transform: [{ translateY: -GAME_PARAMETERS.animation.bounceDistance }] },
  to: { transform: [{ translateY: GAME_PARAMETERS.animation.bounceDistance }] },
};

type CombatantSpriteProps = {
  accessibilityLabel: string;
  attackDirection?: "left" | "right";
  attackProgress?: number | null;
  damageProgress?: number | null;
  animationsPaused?: boolean;
  idleAnimationPaused?: boolean;
  reducedMotion?: boolean;
  sprite: string;
  scale?: number;
  size?: number;
};

export function CombatantSprite({
  accessibilityLabel,
  attackDirection = "right",
  attackProgress = null,
  damageProgress = null,
  animationsPaused = false,
  idleAnimationPaused,
  reducedMotion = false,
  sprite,
  scale = 1,
  size = 48,
}: CombatantSpriteProps) {
  const attackOffset = getAttackOffset(attackProgress, attackDirection);
  const opacity = getDamageOpacity(damageProgress);
  const pauseIdleAnimation = idleAnimationPaused ?? animationsPaused;
  const idleAnimationStyle = useMemo(() => reducedMotion ? null : ({
    animationName: IDLE_BOB,
    animationDuration: `${GAME_PARAMETERS.animation.bounceDurationMs / 2}ms`,
    animationDirection: "alternate" as const,
    animationIterationCount: "infinite" as const,
    animationTimingFunction: "ease-in-out" as const,
    animationPlayState: pauseIdleAnimation ? "paused" as const : "running" as const,
  }), [pauseIdleAnimation, reducedMotion]);
  const containerStyle = useMemo(() => [
    { width: size, height: size, alignItems: "center" as const, justifyContent: "center" as const, flexShrink: 0 as const, overflow: "visible" as const },
    idleAnimationStyle,
  ], [idleAnimationStyle, size]);

  return (
    <Animated.View
      testID="combatant-sprite-idle-layer"
      style={containerStyle}
    >
      <View
        style={[
          styles.sprite,
          {
            width: size,
            height: size,
            opacity,
            transform: [
              { translateX: attackOffset },
              { scale },
            ],
          },
        ]}
      >
        <PixelSprite sprite={sprite} label={accessibilityLabel} size={size} />
      </View>
    </Animated.View>
  );
}

function getAttackOffset(
  progress: number | null,
  attackDirection: "left" | "right",
) {
  if (progress === null) {
    return 0;
  }

  const direction = attackDirection === "right" ? 1 : -1;
  const mirroredProgress = progress <= 0.5 ? progress / 0.5 : (1 - progress) / 0.5;

  return (
    direction *
    GAME_PARAMETERS.animation.attackTravelDistance *
    mirroredProgress
  );
}

function getDamageOpacity(progress: number | null) {
  if (progress === null) {
    return 1;
  }

  return Math.floor(progress * 4) % 2 === 0 ? 0 : 1;
}

const styles = StyleSheet.create({
  sprite: {
    alignItems: "center",
    justifyContent: "center",
    fontSize: 32,
    lineHeight: 38,
  },
});
