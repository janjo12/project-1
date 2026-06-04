import { useEffect, useRef } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

type CombatantSpriteProps = {
  accessibilityLabel: string;
  attackDirection?: "left" | "right";
  attackSignal?: number;
  damageSignal?: number;
  emoji: string;
};

export function CombatantSprite({
  accessibilityLabel,
  attackDirection = "right",
  attackSignal = 0,
  damageSignal = 0,
  emoji,
}: CombatantSpriteProps) {
  const attackOffset = useSharedValue(0);
  const bounce = useSharedValue(0);
  const opacity = useSharedValue(1);
  const previousAttackSignal = useRef(attackSignal);
  const previousDamageSignal = useRef(damageSignal);
  const spriteStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: attackOffset.value },
      { translateY: bounce.value },
    ],
  }));

  useEffect(() => {
    bounce.set(withRepeat(
      withSequence(
        withTiming(-10, { duration: 700 }),
        withTiming(10, { duration: 700 }),
      ),
      -1,
      false,
    ));

    return () => {
      cancelAnimation(bounce);
    };
  }, [bounce]);

  useEffect(() => {
    if (previousAttackSignal.current === attackSignal) {
      return;
    }

    previousAttackSignal.current = attackSignal;
    const attackDistance = attackDirection === "right" ? 42 : -42;

    attackOffset.set(0);
    attackOffset.set(withSequence(
      withTiming(attackDistance, { duration: 250 }),
      withTiming(0, { duration: 250 }),
    ));
  }, [attackDirection, attackOffset, attackSignal]);

  useEffect(() => {
    if (previousDamageSignal.current === damageSignal) {
      return;
    }

    previousDamageSignal.current = damageSignal;

    opacity.set(1);
    opacity.set(withSequence(
      withTiming(0, { duration: 62 }),
      withTiming(1, { duration: 62 }),
      withTiming(0, { duration: 62 }),
      withTiming(1, { duration: 62 }),
    ));
  }, [damageSignal, opacity]);

  return (
    <Animated.View style={[styles.sprite, spriteStyle]}>
      <Text accessibilityLabel={accessibilityLabel} style={styles.emoji}>
        {emoji}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sprite: {
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    fontSize: 54,
    lineHeight: 62,
  },
});
