import { useMemo, useState, useEffect, useRef, type ReactNode } from "react";
import { ACTOR_ENVELOPE, SCENE_WIDTH, SCENE_HEIGHT, layoutRoomActors } from "@/utils/room-scene-layout";
import { Pressable, Text, View, type ViewStyle } from "react-native";

import { CombatantSprite } from "@/components/combatant-sprite";
import { EnemyHealthBar, FloatingResourceLoss } from "@/components/room-combat-feedback";
import { RoomWalls, SceneSprite } from "@/components/room-walls";
import { createStyles } from "@/components/room-scene-styles";
import { useThemeColors } from "@/components/theme";
import { COMBAT_ANIMATION, type CombatAnimationFrame } from "@/entities";
import { RoomFloor } from "@/components/room-floor";
import { Animated, Easing, AccessibilityInfo } from "react-native";
import { getAdjacentRoomTransition } from "@/utils/room-transition";

export type ScenePosition = "top" | "bottom" | "left" | "right" | "center";
type DoorPosition = Exclude<ScenePosition, "center">;
type DoorState = "guarded" | "locked" | "open" | "wall";
export type RoomDoorways = Record<DoorPosition, DoorState>;

export type RoomSceneActor = {
  id: string;
  currentHealth?: number;
  sprite: string;
  kind: "enemy" | "item" | "equipment" | "stairs" | "player";
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
  playerLabel?: string;
  sceneScale: number;
  disabled?: boolean;
  onActorPress?: (actor: RoomSceneActor) => void;
  onDoorwayPress?: (position: DoorPosition) => void;
  onPlayerPress?: () => void;
  roomId?: string;
  reducedMotion?: boolean;
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
  playerLabel = "Player",
  sceneScale,
  canUnlockDoors = false,
  disabled = false,
  onActorPress,
  onDoorwayPress,
  onPlayerPress,
  roomId,
  reducedMotion = false,
}: RoomSceneProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  const [width, setWidth] = useState(0);
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);
  const [transition, setTransition] = useState<{ key: number } | null>(null);
  const previousRoomId = useRef(roomId);
  const transitionProgress = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setSystemReducedMotion(value); }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setSystemReducedMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    if (previousRoomId.current !== roomId) {
      const isAdjacent = getAdjacentRoomTransition(previousRoomId.current, roomId);
      previousRoomId.current = roomId;
      if (!isAdjacent || reducedMotion || systemReducedMotion) { setTransition(null); return; }
      transitionProgress.stopAnimation();
      transitionProgress.setValue(0);
      setTransition(current => ({ key: (current?.key ?? 0) + 1 }));
    }
  }, [roomId, reducedMotion, systemReducedMotion, transitionProgress]);
  useEffect(() => {
    if (!transition) return;
    const animation = Animated.timing(transitionProgress, {
      toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    });
    animation.start(({ finished }) => { if (finished) setTransition(null); });
    return () => animation.stop();
  }, [transition, transitionProgress]);
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
      <Animated.View pointerEvents="box-none" style={{ position: "absolute", left: 0, top: 0,
        width: SCENE_WIDTH, height: SCENE_HEIGHT, transformOrigin: "top left",
        transform: [{ scale: worldScale }], opacity: width > 0 ? 1 : 0 }}>
      {transition ? <Animated.View pointerEvents="none" testID="room-transition-snapshot" style={{
        position: "absolute", zIndex: 5, width: SCENE_WIDTH, height: SCENE_HEIGHT,
        opacity: transitionProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
      }}><RoomSnapshot actors={actors} playerPosition={playerPosition} playerSprite={playerSprite} floorLayer={floorLayer} doorways={doorways} /></Animated.View> : null}
      <Animated.View testID="room-incoming-snapshot" style={{ width: SCENE_WIDTH, height: SCENE_HEIGHT,
        opacity: transition ? transitionProgress : 1 }}>
      <View pointerEvents="none" testID="room-floor-layer" style={{ position: "absolute", width: SCENE_WIDTH, height: SCENE_HEIGHT }}>{floorLayer ?? <RoomFloor />}</View>
      <RoomWalls
        canUnlockDoors={canUnlockDoors}
        disabled={disabled}
        doorways={doorways}
        reducedMotion={reducedMotion || systemReducedMotion}
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
        playerLabel={playerLabel}
        disabled={disabled}
        onPress={onPlayerPress}
      />
      </Animated.View>
      </Animated.View>
      </View>
  );
}

function RoomSnapshot({ actors, playerPosition, playerSprite, floorLayer, doorways }: Pick<RoomSceneProps, "actors" | "playerPosition" | "playerSprite" | "floorLayer" | "doorways">) {
  const slots = layoutRoomActors([...actors.map(actor => ({ id: `${actor.kind}:${actor.id}`, position: actor.position })), { id: "local-player", position: playerPosition }]);
  return <View style={{ width: SCENE_WIDTH, height: SCENE_HEIGHT }}>
    <View pointerEvents="none" style={{ position: "absolute" }}>{floorLayer ?? <RoomFloor />}</View>
    <RoomWalls canUnlockDoors={false} disabled doorways={doorways} reducedMotion />
    {actors.map(actor => <View key={`${actor.kind}:${actor.id}`} style={{ position: "absolute", left: slots[`${actor.kind}:${actor.id}`].x, top: slots[`${actor.kind}:${actor.id}`].y, width: slots[`${actor.kind}:${actor.id}`].size, height: slots[`${actor.kind}:${actor.id}`].size, alignItems: "center", justifyContent: "center" }}><SceneSprite accessibilityLabel="" sprite={actor.sprite} scale={1} size={48} /></View>)}
    <View style={{ position: "absolute", left: slots["local-player"].x, top: slots["local-player"].y, width: slots["local-player"].size, height: slots["local-player"].size, alignItems: "center", justifyContent: "center" }}><SceneSprite accessibilityLabel="" sprite={playerSprite} scale={1} /></View>
  </View>;
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
      <View pointerEvents="none" style={{ width: ACTOR_ENVELOPE, height: ACTOR_ENVELOPE, alignItems: "center", justifyContent: "center", transform: [{ scale: slotScale }] }}>
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
              size={48}
            />
            <EnemyHealthBar
              accessibilityLabel="Enemy health"
              color={colors.health}
              current={actor.currentHealth ?? 1}
              max={actor.maxHealth ?? 1}
              testID="enemy-health-bar"
            />
          </View>
          <Text style={styles.actorLabel} numberOfLines={1}>{actor.label}</Text>
        </View>
      ) : (
        <View style={styles.actorContent}>
          <SceneSprite accessibilityLabel={actor.label} sprite={actor.sprite} scale={sceneScale} size={48} />
          <Text style={styles.actorLabel} numberOfLines={1}>{actor.label}</Text>
        </View>
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
  playerLabel: string;
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
  playerLabel,
  positionStyle,
  slotScale,
  disabled,
  onPress,
}: PlayerActorProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <Pressable
      accessibilityLabel={playerLabel}
      accessibilityHint="Use your class support ability"
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
      <View pointerEvents="none" style={{ width: ACTOR_ENVELOPE, height: ACTOR_ENVELOPE, alignItems: "center", justifyContent: "center", transform: [{ scale: slotScale }] }}>
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
        accessibilityLabel={playerLabel}
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
        size={48}
      />
      <Text style={styles.playerLabel}>{playerLabel}</Text>
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

