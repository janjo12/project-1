import { StyleSheet, Text, View } from "react-native";

type CombatantSpriteProps = {
  accessibilityLabel: string;
  attackDirection?: "left" | "right";
  attackProgress?: number | null;
  bounceOffset?: number;
  damageProgress?: number | null;
  emoji: string;
};

const ATTACK_DISTANCE = 42;

export function CombatantSprite({
  accessibilityLabel,
  attackDirection = "right",
  attackProgress = null,
  bounceOffset = 0,
  damageProgress = null,
  emoji,
}: CombatantSpriteProps) {
  const attackOffset = getAttackOffset(attackProgress, attackDirection);
  const opacity = getDamageOpacity(damageProgress);

  return (
    <View
      style={[
        styles.sprite,
        {
          opacity,
          transform: [
            { translateX: attackOffset },
            { translateY: bounceOffset },
          ],
        },
      ]}
    >
      <Text accessibilityLabel={accessibilityLabel} style={styles.emoji}>
        {emoji}
      </Text>
    </View>
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

  return direction * ATTACK_DISTANCE * mirroredProgress;
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
  },
  emoji: {
    fontSize: 54,
    lineHeight: 62,
  },
});
