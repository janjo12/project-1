import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text } from "react-native";

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
  const [attackOffset] = useState(() => new Animated.Value(0));
  const [bounce] = useState(() => new Animated.Value(0));
  const [opacity] = useState(() => new Animated.Value(1));
  const previousAttackSignal = useRef(attackSignal);
  const previousDamageSignal = useRef(damageSignal);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, {
          duration: 700,
          toValue: -10,
          useNativeDriver: true,
        }),
        Animated.timing(bounce, {
          duration: 700,
          toValue: 10,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [bounce]);

  useEffect(() => {
    if (previousAttackSignal.current === attackSignal) {
      return;
    }

    previousAttackSignal.current = attackSignal;
    const attackDistance = attackDirection === "right" ? 42 : -42;

    Animated.sequence([
      Animated.timing(attackOffset, {
        duration: 250,
        toValue: attackDistance,
        useNativeDriver: true,
      }),
      Animated.timing(attackOffset, {
        duration: 250,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, [attackDirection, attackOffset, attackSignal]);

  useEffect(() => {
    if (previousDamageSignal.current === damageSignal) {
      return;
    }

    previousDamageSignal.current = damageSignal;

    Animated.sequence([
      Animated.timing(opacity, {
        duration: 62,
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        duration: 62,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        duration: 62,
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        duration: 62,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
  }, [damageSignal, opacity]);

  return (
    <Animated.View
      style={[
        styles.sprite,
        {
          opacity,
          transform: [{ translateX: attackOffset }, { translateY: bounce }],
        },
      ]}
    >
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
