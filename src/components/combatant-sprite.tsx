import { PixelSprite } from "@/components/pixel-sprite";
import { StyleSheet, View } from "react-native";
import { GAME_PARAMETERS } from "@/gameparameters";

type CombatantSpriteProps = {
  accessibilityLabel: string;
  attackDirection?: "left" | "right";
  attackProgress?: number | null;
  bounceOffset?: number;
  damageProgress?: number | null;
  sprite: string;
  scale?: number;
};

export function CombatantSprite({
  accessibilityLabel,
  attackDirection = "right",
  attackProgress = null,
  bounceOffset = 0,
  damageProgress = null,
  sprite,
  scale = 1,
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
            { scale },
          ],
        },
      ]}
    >
      <PixelSprite sprite={sprite} label={accessibilityLabel} />
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
