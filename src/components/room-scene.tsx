import { PixelSprite } from "@/components/pixel-sprite";
import { useMemo, useState, type ReactNode } from "react";
import { ACTOR_ENVELOPE, SCENE_WIDTH, SCENE_HEIGHT, layoutRoomActors } from "@/utils/room-scene-layout";
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
  kind: "enemy" | "item" | "stairs" | "player";
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
  floorLayer?: ReactNode;
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



export function RoomScene({
  actors,
  floorLayer,
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

  const [width, setWidth] = useState(0);
  const slots = useMemo(() => layoutRoomActors([
    ...actors.map(actor => ({ id: `${actor.kind}:${actor.id}`, position: actor.position })),
    { id: "local-player", position: playerPosition },
  ]), [actors, playerPosition]);
  const worldScale = width / SCENE_WIDTH;
  function slotStyle(id: string): ViewStyle {
    const slot = slots[id];
    return { left: slot.x, top: slot.y, width: slot.size, height: slot.size };
  }

  return (
    <View style={[styles.sceneArea, { height: width > 0 ? width * SCENE_HEIGHT / SCENE_WIDTH + 10 : 240 }]}
      onLayout={event => setWidth(Math.max(0, event.nativeEvent.layout.width - 10))}>
      <View pointerEvents="box-none" style={{ position: "absolute", left: 0, top: 0,
        width: SCENE_WIDTH, height: SCENE_HEIGHT, transformOrigin: "top left",
        transform: [{ scale: worldScale }], opacity: width > 0 ? 1 : 0 }}>
      <View pointerEvents="none" testID="room-floor-layer" style={{ position: "absolute", width: SCENE_WIDTH, height: SCENE_HEIGHT }}>{floorLayer ?? (
        <View style={{ width: SCENE_WIDTH, height: SCENE_HEIGHT, overflow: "hidden", flexDirection: "row", flexWrap: "wrap", opacity: 0.25 }}>
          {Array.from({ length: Math.ceil(SCENE_WIDTH / 32) * Math.ceil(SCENE_HEIGHT / 32) }, (_, index) => (
            <PixelSprite key={index} sprite="stone-floor" label="" />
          ))}
        </View>
      )}</View>
      <RoomWalls
        canUnlockDoors={canUnlockDoors}
        disabled={disabled}
        doorways={doorways}
        onPress={onDoorwayPress}
      />

      {actors.map((actor) => (
        <SceneActor
          actor={actor}
          animationFrame={animationFrame}
          bounceOffset={bounceOffset}
          enemyHealthLossAmount={enemyHealthLossAmount}
          key={`${actor.kind}:${actor.id}`}
          positionStyle={slotStyle(`${actor.kind}:${actor.id}`)}
          slotScale={slots[`${actor.kind}:${actor.id}`].size / ACTOR_ENVELOPE}
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
        positionStyle={slotStyle("local-player")}
        slotScale={slots["local-player"].size / ACTOR_ENVELOPE}
        sceneScale={sceneScale}
        sprite={playerSprite}
        disabled={disabled}
        onPress={onPlayerPress}
      />
      </View>
    </View>
  );
}

type SceneActorProps = {
  actor: RoomSceneActor;
  animationFrame: CombatAnimationFrame;
  bounceOffset: number;
  enemyHealthLossAmount: number;
  sceneScale: number;
  positionStyle: ViewStyle;
  slotScale: number;
  disabled: boolean;
  onPress?: (actor: RoomSceneActor) => void;
};

function SceneActor({
  actor,
  animationFrame,
  bounceOffset,
  enemyHealthLossAmount,
  sceneScale,
  positionStyle,
  slotScale,
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
      onPress={() => onPress?.(actor)}
      style={({ pressed }) => [
        styles.actorPosition,
        positionStyle,
        pressed && styles.pressedActor,
      ]}
    >
      <View style={{ width: ACTOR_ENVELOPE, height: ACTOR_ENVELOPE, alignItems: "center", justifyContent: "center", transform: [{ scale: slotScale }] }}>
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
      </View>
    </Pressable>
  );
}

type PlayerActorProps = {
  animationFrame: CombatAnimationFrame;
  bounceOffset: number;
  energyLossAmount: number;
  healthLossAmount: number;
  sceneScale: number;
  sprite: string;
  positionStyle: ViewStyle;
  slotScale: number;
  disabled: boolean;
  onPress?: () => void;
};

function PlayerActor({
  animationFrame,
  bounceOffset,
  energyLossAmount,
  healthLossAmount,
  sceneScale,
  sprite,
  positionStyle,
  slotScale,
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
      onPress={onPress}
      style={({ pressed }) => [
        styles.actorPosition,
        positionStyle,
        pressed && styles.pressedActor,
      ]}
    >
      <View style={{ width: ACTOR_ENVELOPE, height: ACTOR_ENVELOPE, alignItems: "center", justifyContent: "center", transform: [{ scale: slotScale }] }}>
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
      </View>
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

