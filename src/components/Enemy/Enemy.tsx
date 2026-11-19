import { PixelSprite } from "@/components/Common/PixelSprite";
import { getIdleBobStyle } from "@/components/Common/idleBob";
import { useMemo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { GAME_PARAMETERS } from "@/game/config/gameparameters";

type CombatantSpriteProps = {
  accessibilityLabel: string;
  attackDirection?: "left" | "right";
  attackVector?: { x: number; y: number };
  attackDistance?: number;
  damageVector?: { x: number; y: number };
  attackProgress?: number | null;
  damageProgress?: number | null;
  animationsPaused?: boolean;
  idleAnimationPaused?: boolean;
  reducedMotion?: boolean;
  children?: ReactNode;
  sprite: string;
  scale?: number;
  size?: number;
};

export function CombatantSprite({
  accessibilityLabel,
  attackDirection = "right",
  attackVector,
  attackDistance,
  damageVector,
  attackProgress = null,
  damageProgress = null,
  animationsPaused = false,
  idleAnimationPaused,
  reducedMotion = false,
  children,
  sprite,
  scale = 1,
  size = 48,
}: CombatantSpriteProps) {
  const attackOffset = getAttackOffset(attackProgress, attackVector, attackDirection, attackDistance);
  const hitMotion = getHitMotion(damageProgress, damageVector ?? { x: attackDirection === "right" ? 1 : -1, y: 0 });
  const opacity = getDamageOpacity(damageProgress);
  const pauseIdleAnimation = idleAnimationPaused ?? animationsPaused;
  const idleAnimationStyle = useMemo(() => getIdleBobStyle(pauseIdleAnimation, reducedMotion), [pauseIdleAnimation, reducedMotion]);
  const containerStyle = useMemo(() => [
    { width: size, height: size, alignItems: "center" as const, justifyContent: "center" as const, flexShrink: 0 as const, overflow: "visible" as const, position: "relative" as const },
    idleAnimationStyle,
  ], [idleAnimationStyle, size]);
  // React Native Web adds CSS animation properties that are intentionally not
  // part of React Native's cross-platform ViewStyle definition.
  const animatedContainerStyle = containerStyle as unknown as React.ComponentProps<typeof Animated.View>["style"];

  return (
    <Animated.View
      testID="combatant-sprite-idle-layer"
      style={animatedContainerStyle}
    >
      <View
        style={[
          styles.sprite,
          {
            width: size,
            height: size,
            opacity,
            transform: [
              { translateX: attackOffset.x + hitMotion.x },
              { translateY: attackOffset.y + hitMotion.y },
              { rotateZ: `${hitMotion.rotation}deg` },
              { scaleX: hitMotion.scaleX },
              { scaleY: hitMotion.scaleY },
              { scale },
            ],
          },
        ]}
      >
        {damageProgress !== null && damageProgress < 0.3 ? (
          <View pointerEvents="none" testID="combat-impact-flash" style={{ position: "absolute", width: size * (1.15 + damageProgress * 2), height: size * (1.15 + damageProgress * 2), borderColor: "#fff7ed", borderRadius: size, borderWidth: Math.max(2, size * 0.07), backgroundColor: "rgba(249, 115, 22, 0.28)", opacity: Math.max(0, 0.9 * (1 - damageProgress / 0.3)), transform: [{ scale: 0.9 + damageProgress * 1.8 }] }} />
        ) : null}
        <PixelSprite sprite={sprite} label={accessibilityLabel} size={size} />
      </View>
      {children ? (
        <View pointerEvents="none" style={{ alignItems: "center", left: "50%", marginLeft: -24, position: "absolute", top: size - 4, width: 48, transform: [{ translateX: attackOffset.x + hitMotion.x }, { translateY: attackOffset.y + hitMotion.y }] }}>
          {children}
        </View>
      ) : null}
    </Animated.View>
  );
}

function getAttackOffset(
  progress: number | null,
  attackVector: { x: number; y: number } | undefined,
  attackDirection: "left" | "right",
  attackDistance?: number,
) {
  if (progress === null) {
    return { x: 0, y: 0 };
  }

  const fallback = { x: attackDirection === "right" ? 1 : -1, y: 0 };
  const vector = normalizeVector(attackVector ?? fallback);
  const distance = attackDistance ?? GAME_PARAMETERS.animation.attackTravelDistance;
  const distanceScale = getLungeProgress(progress);

  return {
    x: vector.x * distance * distanceScale,
    y: vector.y * distance * distanceScale,
  };
}

function getDamageOpacity(progress: number | null) {
  if (progress === null) {
    return 1;
  }

  if (progress < 0.12) return 1;
  return Math.floor((progress - 0.12) * 18) % 4 === 0 ? 0.58 : 1;
}

function getLungeProgress(progress: number) {
  const value = Math.max(0, Math.min(1, progress));
  if (value < 0.44) return 1.12 * Math.pow(value / 0.44, 1.6);
  if (value < 0.52) return 1.12 + 0.3 * ((value - 0.44) / 0.08);
  if (value < 0.6) return 1.42;
  if (value < 0.74) {
    const recoil = (value - 0.6) / 0.14;
    return 1.42 - 0.66 * (1 - Math.pow(1 - recoil, 3));
  }
  if (value < 0.94) {
    const recovery = (value - 0.74) / 0.2;
    return 0.76 * (1 - recovery * recovery * (3 - 2 * recovery));
  }
  return 0;
}

function getHitMotion(progress: number | null, vector: { x: number; y: number }) {
  if (progress === null) return { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
  const value = Math.max(0, Math.min(1, progress));
  const direction = normalizeVector(vector);
  // Hold the overlap for a few frames on impact, then snap the target away.
  const recoilProgress = Math.max(0, (value - 0.18) / 0.82);
  const recovery = Math.pow(1 - recoilProgress, 1.35);
  const shake = Math.sin(recoilProgress * Math.PI * 8) * 6 * recovery;
  const squash = Math.max(0, 1 - value * 4.2);
  const impactLift = Math.sin(recoilProgress * Math.PI) * 5;
  return {
    x: direction.x * 26 * recovery + direction.y * shake,
    y: direction.y * 26 * recovery - direction.x * shake - impactLift,
    rotation: direction.x === 0 ? 0 : direction.x * 11 * recovery,
    scaleX: 1 - 0.28 * squash,
    scaleY: 1 + 0.38 * squash,
  };
}

function normalizeVector(vector: { x: number; y: number }) {
  const length = Math.hypot(vector.x, vector.y) || 1;
  return { x: vector.x / length, y: vector.y / length };
}

const styles = StyleSheet.create({
  sprite: {
    alignItems: "center",
    justifyContent: "center",
    fontSize: 32,
    lineHeight: 38,
  },
});
