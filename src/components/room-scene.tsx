import { Pressable, View, type ViewStyle } from "react-native";

import { CombatantSprite } from "@/components/combatant-sprite";
import { EnemyHealthBar, FloatingResourceLoss } from "@/components/room-combat-feedback";
import { RoomWalls, SceneSprite } from "@/components/room-walls";
import { createStyles } from "@/components/room-scene-styles";
import { useThemeColors } from "@/components/theme";
import { COMBAT_ANIMATION, type CombatAnimationFrame } from "@/entities";

export type ScenePosition = "top" | "bottom" | "left" | "right" | "center";
type DoorPosition = Exclude<ScenePosition, "center">;
type DoorState = "guarded" | "locked" | "open" | "wall";
export type RoomDoorways = Record<DoorPosition, DoorState>;

export type RoomSceneActor = {
  id: string;
  currentHealth?: number;
  sprite: string;
  kind: "enemy" | "item" | "stairs";
  label: string;
  position?: ScenePosition;
  isActive?: boolean;
  maxHealth?: number;
};

type RoomSceneProps = {
  canUnlockDoors?: boolean;
  animationFrame: CombatAnimationFrame;
  bounceOffset: number;
  doorways: RoomDoorways;
  enemyHealthLossAmount: number;
  actors: RoomSceneActor[];
  playerEnergyLossAmount: number;
  playerHealthLossAmount: number;
  playerPosition: ScenePosition;
  playerSprite: string;
  sceneScale: number;
  disabled?: boolean;
  onActorPress?: (actor: RoomSceneActor) => void;
  onDoorwayPress?: (position: DoorPosition) => void;
  onPlayerPress?: () => void;
};

const SCENE_SPRITE_HALF_SIZE = 32;

export function RoomScene({
  actors,
  animationFrame,
  bounceOffset,
  doorways,
  enemyHealthLossAmount,
  playerEnergyLossAmount,
  playerHealthLossAmount,
  playerPosition,
  playerSprite,
  sceneScale,
  canUnlockDoors = false,
  disabled = false,
  onActorPress,
  onDoorwayPress,
  onPlayerPress,
}: RoomSceneProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.sceneArea}>
      <RoomWalls
        canUnlockDoors={canUnlockDoors}
        disabled={disabled}
        doorways={doorways}
        onPress={onDoorwayPress}
      />

      {actors.map((actor, index) => (
        <SceneActor
          actor={actor}
          animationFrame={animationFrame}
          bounceOffset={bounceOffset}
          enemyHealthLossAmount={enemyHealthLossAmount}
          key={`${actor.kind}-${actor.label}-${index}`}
          disabled={disabled}
          onPress={onActorPress}
          sceneScale={sceneScale}
        />
      ))}

      <PlayerActor
        animationFrame={animationFrame}
        bounceOffset={bounceOffset}
        energyLossAmount={playerEnergyLossAmount}
        healthLossAmount={playerHealthLossAmount}
        position={playerPosition}
        sceneScale={sceneScale}
        sprite={playerSprite}
        disabled={disabled}
        onPress={onPlayerPress}
      />
    </View>
  );
}

type SceneActorProps = {
  actor: RoomSceneActor;
  animationFrame: CombatAnimationFrame;
  bounceOffset: number;
  enemyHealthLossAmount: number;
  sceneScale: number;
  disabled: boolean;
  onPress?: (actor: RoomSceneActor) => void;
};

function SceneActor({
  actor,
  animationFrame,
  bounceOffset,
  enemyHealthLossAmount,
  sceneScale,
  disabled,
  onPress,
}: SceneActorProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const isActive = actor.isActive ?? true;

  return (
    <Pressable
      accessibilityLabel={actor.label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={() => onPress?.(actor)}
      style={({ pressed }) => [
        styles.actorPosition,
        getActorPosition(actor.position ?? "center"),
        pressed && styles.pressedActor,
      ]}
    >
      {actor.kind === "enemy" ? (
        <View style={styles.actorContent}>
          {isActive ? (
            <FloatingResourceLoss
              amount={enemyHealthLossAmount}
              color={colors.health}
              icon="heart"
              progress={getProgress(
                animationFrame.enemyHealthLossElapsed,
                COMBAT_ANIMATION.resourceLossDuration,
              )}
              testID="enemy-health-loss"
            />
          ) : null}
          <View style={{ transform: [{ translateY: bounceOffset }] }}>
            <CombatantSprite
              accessibilityLabel={actor.label}
              attackDirection="right"
              attackProgress={
                isActive
                  ? getProgress(
                      animationFrame.enemyAttackElapsed,
                      COMBAT_ANIMATION.attackDuration,
                    )
                  : null
              }
              damageProgress={
                isActive
                  ? getProgress(
                      animationFrame.enemyDamageElapsed,
                      COMBAT_ANIMATION.damageDuration,
                    )
                  : null
              }
              sprite={actor.sprite}
              scale={sceneScale}
            />
            <EnemyHealthBar
              accessibilityLabel="Enemy health"
              color={colors.health}
              current={actor.currentHealth ?? 1}
              max={actor.maxHealth ?? 1}
              testID="enemy-health-bar"
            />
          </View>
        </View>
      ) : (
        <SceneSprite
          accessibilityLabel={actor.label}
          sprite={actor.sprite}
          scale={sceneScale}
        />
      )}
    </Pressable>
  );
}

type PlayerActorProps = {
  animationFrame: CombatAnimationFrame;
  bounceOffset: number;
  energyLossAmount: number;
  healthLossAmount: number;
  position: ScenePosition;
  sceneScale: number;
  sprite: string;
  disabled: boolean;
  onPress?: () => void;
};

function PlayerActor({
  animationFrame,
  bounceOffset,
  energyLossAmount,
  healthLossAmount,
  position,
  sceneScale,
  sprite,
  disabled,
  onPress,
}: PlayerActorProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <Pressable
      accessibilityLabel="Defend"
      accessibilityHint="Halves incoming damage and counterattacks"
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actorPosition,
        getActorPosition(position),
        pressed && styles.pressedActor,
      ]}
    >
      <FloatingResourceLoss
        amount={healthLossAmount}
        color={colors.health}
        icon="heart"
        progress={getProgress(
          animationFrame.playerHealthLossElapsed,
          COMBAT_ANIMATION.resourceLossDuration,
        )}
        testID="player-health-loss"
      />
      <FloatingResourceLoss
        amount={energyLossAmount}
        color={colors.energy}
        icon="bolt"
        progress={getProgress(
          animationFrame.playerEnergyLossElapsed,
          COMBAT_ANIMATION.resourceLossDuration,
        )}
        testID="player-energy-loss"
      />
      <CombatantSprite
        accessibilityLabel="Player warrior"
        attackDirection="left"
        attackProgress={getProgress(
          animationFrame.playerAttackElapsed,
          COMBAT_ANIMATION.attackDuration,
        )}
        bounceOffset={bounceOffset}
        damageProgress={getProgress(
          animationFrame.playerDamageElapsed,
          COMBAT_ANIMATION.damageDuration,
        )}
        sprite={sprite}
        scale={sceneScale}
      />
    </Pressable>
  );
}

export function getProgress(elapsed: number | null, duration: number) {
  if (elapsed === null) {
    return null;
  }

  return Math.max(0, Math.min(1, elapsed / duration));
}

export function getBounceOffset(elapsed: number) {
  const progress =
    (elapsed % COMBAT_ANIMATION.bounceDuration) /
    COMBAT_ANIMATION.bounceDuration;

  return Math.sin(progress * Math.PI * 2) * COMBAT_ANIMATION.bounceDistance;
}

function getActorPosition(position: ScenePosition): ViewStyle {
  switch (position) {
    case "top":
      return {
        top: 10,
        left: "50%",
        transform: [{ translateX: -SCENE_SPRITE_HALF_SIZE }],
      };

    case "bottom":
      return {
        bottom: 10,
        left: "50%",
        transform: [{ translateX: -SCENE_SPRITE_HALF_SIZE }],
      };

    case "left":
      return {
        left: 10,
        top: "50%",
        transform: [{ translateY: -SCENE_SPRITE_HALF_SIZE }],
      };

    case "right":
      return {
        right: 10,
        top: "50%",
        transform: [{ translateY: -SCENE_SPRITE_HALF_SIZE }],
      };

    case "center":
      return {
        left: "50%",
        top: "50%",
        transform: [
          { translateX: -SCENE_SPRITE_HALF_SIZE },
          { translateY: -SCENE_SPRITE_HALF_SIZE },
        ],
      };
  }
}
