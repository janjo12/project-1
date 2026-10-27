import { ACTOR_ENVELOPE, HUMAN_FORM_SPRITE_SIZE, SCENE_HEIGHT, SCENE_WIDTH, getActorSpriteSize, getHumanFormScale, layoutRoomActors } from "@/utils/coordinates";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Platform, Pressable, View, type ViewInstance, type ViewStyle } from "react-native";

import { useThemeColors } from "@/components/Common/theme";
import { measureViewCenterNow } from "@/components/Common/SpriteFlight";
import { PlayerAura } from "@/components/Common/PlayerAura";
import { RoomFloor } from "@/components/Dungeon/Floor";
import { RoomWalls, SceneSprite } from "@/components/Dungeon/Walls";
import { createStyles } from "@/components/Dungeon/room-scene-styles";
import { CombatantSprite } from "@/components/Enemy/Enemy";
import { EnemyHealthBar, FloatingResourceLoss } from "@/components/Enemy/EnemyFeedback";
import { COMBAT_ANIMATION, createCombatAnimationFrame, type CombatAnimationFrame } from "@/game/entities";
import { GAME_PARAMETERS } from "@/game/config/gameparameters";
import { getAdjacentRoomTransition } from "@/utils/room-transition";
import { AccessibilityInfo } from "react-native";
import Animated from "react-native-reanimated";
import type { SceneFrameStore } from "@/game/state/sceneFrameStore";

const ROOM_FADE_IN = { from: { opacity: 0 }, to: { opacity: 1 } };
const ROOM_TRANSITION_DURATION_MS = GAME_PARAMETERS.animation.roomTransitionDurationMs;
const PLAYER_EXIT_DURATION_MS = GAME_PARAMETERS.animation.roomExitDurationMs;
const PLAYER_ENTRY_DURATION_MS = GAME_PARAMETERS.animation.roomEntryDurationMs;
const DOORWAY_PLAYER_INSET = 50;
const PLAYER_EXIT_MOTION: Record<DoorPosition, { from: { transform: { translateX?: number; translateY?: number }[] }; to: { transform: { translateX?: number; translateY?: number }[] } }> = {
  top: { from: { transform: [{ translateY: 0 }] }, to: { transform: [{ translateY: -34 }] } },
  right: { from: { transform: [{ translateX: 0 }] }, to: { transform: [{ translateX: 34 }] } },
  bottom: { from: { transform: [{ translateY: 0 }] }, to: { transform: [{ translateY: 34 }] } },
  left: { from: { transform: [{ translateX: 0 }] }, to: { transform: [{ translateX: -34 }] } },
};

export type ScenePosition = "top" | "bottom" | "left" | "right" | "center";
export type ScreenPoint = { x: number; y: number };
type DoorPosition = Exclude<ScenePosition, "center">;
type DoorState = "guarded" | "locked" | "open" | "wall";
export type RoomDoorways = Record<DoorPosition, DoorState>;

export type RoomSceneActor = {
  id: string;
  auraColor?: string;
  contentSprite?: string;
  currentHealth?: number;
  sprite: string;
  isChest?: boolean;
  kind: "enemy" | "item" | "equipment" | "stairs" | "player";
  label: string;
  position?: ScenePosition;
  isActive?: boolean;
  maxHealth?: number;
};

type RoomSceneProps = {
  canUnlockDoors?: boolean;
  canPassBlockedDoorways?: boolean;
  animationFrame?: CombatAnimationFrame;
  sceneFrameStore?: SceneFrameStore;
  doorways: RoomDoorways;
  enemyHealthLossAmount: number;
  actors: RoomSceneActor[];
  floorLayer?: ReactNode;
  playerEnergyLossAmount: number;
  playerHealthLossAmount: number;
  playerPosition: ScenePosition;
  playerSprite: string;
  playerAuraColor?: string;
  playerLabel?: string;
  sceneScale: number;
  disabled?: boolean;
  onActorPress?: (actor: RoomSceneActor, source?: ScreenPoint) => void;
  onDoorwayPress?: (position: DoorPosition) => void;
  onPlayerPress?: () => void;
  roomId?: string;
  reducedMotion?: boolean;
  animationsPaused?: boolean;
  maxHeight?: number;
};

export function RoomScene({
  actors,
  floorLayer,
  animationFrame,
  sceneFrameStore,
  doorways,
  enemyHealthLossAmount,
  playerEnergyLossAmount,
  playerHealthLossAmount,
  playerPosition,
  playerSprite,
  playerAuraColor,
  playerLabel = "Player",
  sceneScale,
  canUnlockDoors = false,
  canPassBlockedDoorways = false,
  disabled = false,
  onActorPress,
  onDoorwayPress,
  onPlayerPress,
  roomId,
  reducedMotion = false,
  animationsPaused = false,
  maxHeight,
}: RoomSceneProps) {
  // Render in fixed logical coordinates, then scale once to the measured device width.
  const colors = useThemeColors();
  const styles = createStyles(colors);

  const [width, setWidth] = useState(0);
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);
  const [transitionKey, setTransitionKey] = useState<number | null>(null);
  const previousRoomId = useRef(roomId);
  const nextTransitionKey = useRef(0);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setSystemReducedMotion(value); }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setSystemReducedMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  useLayoutEffect(() => {
    if (previousRoomId.current !== roomId) {
      const isAdjacent = getAdjacentRoomTransition(previousRoomId.current, roomId);
      if (!isAdjacent || reducedMotion || systemReducedMotion || animationsPaused) {
        setTransitionKey(null);
      } else {
        nextTransitionKey.current += 1;
        setTransitionKey(nextTransitionKey.current);
      }
    }
    previousRoomId.current = roomId;
  }, [roomId, reducedMotion, systemReducedMotion, animationsPaused]);
  useEffect(() => {
    if (transitionKey === null || animationsPaused) return;
    const timeout = setTimeout(() => {
      setTransitionKey(null);
    }, ROOM_TRANSITION_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [transitionKey, animationsPaused]);
  const [layoutCache, setLayoutCache] = useState<{ roomId?: string; actors: { id: string; position?: ScenePosition }[]; inputActors: RoomSceneActor[]; playerPosition: ScenePosition } | null>(null);
  const layoutCacheMatches = layoutCache !== null
    && layoutCache.roomId === roomId
    && layoutCache.inputActors === actors
    && layoutCache.playerPosition === playerPosition;
  const cachedLayout = layoutCache && layoutCache.roomId === roomId ? layoutCache.actors : null;
  const layoutActors = useMemo(() => {
    const previous = cachedLayout;
    const entries = previous ? previous.slice() : [];
    const knownActorIds = new Set(entries.map(actor => actor.id));
    for (const actor of actors) {
      const id = `${actor.kind}:${actor.id}`;
      if (!knownActorIds.has(id)) {
        entries.push({ id, position: actor.position });
        knownActorIds.add(id);
      }
    }
    const playerLayout = entries.find(actor => actor.id === "local-player");
    if (playerLayout) playerLayout.position = playerPosition;
    else entries.push({ id: "local-player", position: playerPosition });
    return entries;
  }, [actors, playerPosition, cachedLayout]);
  if (!layoutCacheMatches) {
    setLayoutCache({ roomId, actors: layoutActors, inputActors: actors, playerPosition });
  }
  // Keep slots for defeated/collected actors reserved until the room changes. Their removal
  // therefore cannot recenter every other sprite at the end of an attack animation.
  const slots = useMemo(() => layoutRoomActors(layoutActors), [layoutActors]);
  const humanFormScale = getHumanFormScale(1 + actors.filter(actor => actor.kind === "player").length);
  function slotStyle(id: string): ViewStyle {
    const slot = slots[id];
    const inset = id === "local-player" ? getDoorwayPlayerInset(playerPosition) : [0, 0];
    return { left: slot.x + inset[0], top: slot.y + inset[1], width: slot.size, height: slot.size };
  }

  const scale = width > 0
    ? Math.min(width / SCENE_WIDTH, Math.max(0, (maxHeight ?? Infinity) - 10) / SCENE_HEIGHT)
    : 0;
  const sceneWidth = SCENE_WIDTH * scale;
  const sceneHeight = SCENE_HEIGHT * scale;

  return (
    <View style={{ alignItems: "center", width: "100%" }} onLayout={event => setWidth(Math.max(0, event.nativeEvent.layout.width - 10))}>
    <View testID="dungeon-room-frame" style={[styles.sceneArea, { width: sceneWidth + 10, height: sceneHeight + 10 }]}>
      <Animated.View pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0,
        width: SCENE_WIDTH, height: SCENE_HEIGHT, transformOrigin: "top left",
        transform: [{ scale }], opacity: width > 0 ? 1 : 0 }}>
      <Animated.View testID="room-incoming-snapshot" style={{ width: SCENE_WIDTH, height: SCENE_HEIGHT,
        ...(transitionKey !== null ? {
          animationName: ROOM_FADE_IN,
          animationDuration: `${ROOM_TRANSITION_DURATION_MS}ms`,
          animationTimingFunction: "ease-out",
          animationFillMode: "forwards" as const,
          animationPlayState: animationsPaused ? "paused" as const : "running" as const,
        } : {}) }}>
      <View pointerEvents="none" testID="room-floor-layer" style={{ position: "absolute", width: SCENE_WIDTH, height: SCENE_HEIGHT }}>{floorLayer ?? <RoomFloor />}</View>
      <RoomWalls
        canUnlockDoors={canUnlockDoors}
        canPassBlockedDoorways={canPassBlockedDoorways}
        disabled={disabled}
        doorways={doorways}
        playerPosition={playerPosition}
        reducedMotion={reducedMotion || systemReducedMotion}
        animationsPaused={animationsPaused}
        onPress={onDoorwayPress}
      />

      {actors.map((actor) => (
        <SceneActor
          actor={actor}
          sceneFrameStore={sceneFrameStore}
          animationFrame={animationFrame}
          enemyHealthLossAmount={enemyHealthLossAmount}
          key={`${actor.kind}:${actor.id}`}
          positionStyle={slotStyle(`${actor.kind}:${actor.id}`)}
          slotScale={getActorSpriteSize(actor.sprite) === HUMAN_FORM_SPRITE_SIZE
            ? humanFormScale
            : slots[`${actor.kind}:${actor.id}`].size / ACTOR_ENVELOPE}
          animationsPaused={animationsPaused}
          disabled={disabled}
          reducedMotion={reducedMotion || systemReducedMotion}
          onPress={onActorPress}
          sceneScale={sceneScale}
        />
      ))}

      <PlayerActor
        sceneFrameStore={sceneFrameStore}
        animationFrame={animationFrame}
        energyLossAmount={playerEnergyLossAmount}
        healthLossAmount={playerHealthLossAmount}
        positionStyle={slotStyle("local-player")}
        slotScale={humanFormScale}
        sceneScale={sceneScale}
        sprite={playerSprite}
        auraColor={playerAuraColor}
        playerLabel={playerLabel}
        disabled={disabled}
        reducedMotion={reducedMotion || systemReducedMotion}
        animationsPaused={animationsPaused}
        entering={transitionKey !== null}
        entryPosition={playerPosition}
        onPress={onPlayerPress}
      />
      </Animated.View>
      </Animated.View>
      <RoomFrameBorder doorways={doorways} colors={colors} width={sceneWidth} height={sceneHeight} />
    </View>
    </View>
  );
}

function RoomFrameBorder({ doorways, colors, width, height }: {
  doorways: RoomDoorways;
  colors: ReturnType<typeof useThemeColors>;
  width: number;
  height: number;
}) {
  const border = 5;
  const totalWidth = width + border * 2;
  const totalHeight = height + border * 2;
  const horizontalGapStart = border + width * 0.36;
  const horizontalGapWidth = width * 0.28;
  const verticalGapStart = border + height * 0.38;
  const verticalGapHeight = height * 0.24;
  const gaps = [
    ...(doorways.top !== "wall" ? [{ direction: "top", style: { left: horizontalGapStart, top: 0, width: horizontalGapWidth, height: border } }] : []),
    ...(doorways.bottom !== "wall" ? [{ direction: "bottom", style: { left: horizontalGapStart, top: totalHeight - border, width: horizontalGapWidth, height: border } }] : []),
    ...(doorways.left !== "wall" ? [{ direction: "left", style: { left: 0, top: verticalGapStart, width: border, height: verticalGapHeight } }] : []),
    ...(doorways.right !== "wall" ? [{ direction: "right", style: { left: totalWidth - border, top: verticalGapStart, width: border, height: verticalGapHeight } }] : []),
  ];
  return <View pointerEvents="none" testID="room-frame-border" style={{ position: "absolute", top: -border, left: -border, width: totalWidth, height: totalHeight }}>
    {gaps.map(({ direction, style }) => <View key={direction} testID={`room-frame-gap-${direction}`} style={[style, { position: "absolute", backgroundColor: colors.paper }]} />)}
  </View>;
}

type SceneActorProps = {
  actor: RoomSceneActor;
  animationFrame?: CombatAnimationFrame;
  sceneFrameStore?: SceneFrameStore;
  enemyHealthLossAmount: number;
  sceneScale: number;
  positionStyle: ViewStyle;
  slotScale: number;
  disabled: boolean;
  reducedMotion: boolean;
  animationsPaused: boolean;
  onPress?: (actor: RoomSceneActor, source?: ScreenPoint) => void;
};

function SceneActor({
  actor,
  animationFrame,
  sceneFrameStore,
  enemyHealthLossAmount,
  sceneScale,
  positionStyle,
  slotScale,
  disabled,
  reducedMotion,
  animationsPaused,
  onPress,
}: SceneActorProps) {
  const actorRef = useRef<ViewInstance>(null);
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const isActive = actor.isActive ?? true;

  return (
    <Pressable
      accessibilityLabel={actor.label}
      accessibilityHint={actor.kind === "player" ? "Support this ally" : undefined}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      ref={actorRef}
      onPress={event => {
        if (actor.kind !== "item" && actor.kind !== "equipment") {
          onPress?.(actor);
          return;
        }
        // Resolve the browser coordinates synchronously so frozen test clocks never delay pickup.
        const { pageX, pageY } = event.nativeEvent;
        const source = Number.isFinite(pageX) && Number.isFinite(pageY) && (pageX !== 0 || pageY !== 0)
          ? { x: pageX - (Platform.OS === "web" ? window.scrollX : 0), y: pageY - (Platform.OS === "web" ? window.scrollY : 0) }
          : measureViewCenterNow(actorRef.current);
        onPress?.(actor, source ?? undefined);
      }}
      style={({ pressed }) => [
        styles.actorPosition,
        positionStyle,
        pressed && styles.pressedActor,
      ]}
    >
      <View pointerEvents="none" style={{ width: ACTOR_ENVELOPE, height: ACTOR_ENVELOPE, alignItems: "center", justifyContent: "center", transform: [{ scale: slotScale }] }}>
      {actor.kind === "enemy" ? (
        <View style={styles.actorContent}>
          <View>
            {isActive ? <EnemyAnimationLayer
              accessibilityLabel={actor.label}
              amount={enemyHealthLossAmount}
              animationFrame={animationFrame}
              reducedMotion={reducedMotion}
              animationsPaused={animationsPaused}
              sceneFrameStore={sceneFrameStore}
              sprite={actor.sprite}
              scale={sceneScale}
            /> : <CombatantSprite accessibilityLabel={actor.label} animationsPaused={animationsPaused} reducedMotion={reducedMotion} sprite={actor.sprite} scale={sceneScale} size={getActorSpriteSize(actor.sprite)} />}
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
        <View style={styles.actorContent}>
          {actor.kind === "player" && actor.auraColor ? <PlayerAura color={actor.auraColor} /> : null}
          <SceneSprite accessibilityLabel={actor.label} sprite={actor.sprite} scale={sceneScale} size={getActorSpriteSize(actor.sprite)} />
        </View>
      )}
      </View>
    </Pressable>
  );
}

type PlayerActorProps = {
  animationFrame?: CombatAnimationFrame;
  sceneFrameStore?: SceneFrameStore;
  energyLossAmount: number;
  healthLossAmount: number;
  sceneScale: number;
  sprite: string;
  auraColor?: string;
  playerLabel: string;
  positionStyle: ViewStyle;
  slotScale: number;
  disabled: boolean;
  reducedMotion: boolean;
  animationsPaused: boolean;
  entering: boolean;
  entryPosition: ScenePosition;
  onPress?: () => void;
};

function PlayerActor({
  animationFrame,
  sceneFrameStore,
  energyLossAmount,
  healthLossAmount,
  sceneScale,
  sprite,
  auraColor,
  playerLabel,
  positionStyle,
  slotScale,
  disabled,
  reducedMotion,
  animationsPaused,
  entering,
  entryPosition,
  onPress,
}: PlayerActorProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const previousPosition = useRef(entryPosition);
  const [exitDirection, setExitDirection] = useState<DoorPosition | null>(null);
  useLayoutEffect(() => {
    if (entering) {
      previousPosition.current = entryPosition;
      setExitDirection(null);
      return;
    }
    if (previousPosition.current !== entryPosition && entryPosition !== "center") {
      setExitDirection(entryPosition);
    }
    previousPosition.current = entryPosition;
  }, [entering, entryPosition]);
  const positionTransition = Platform.OS === "web" && !reducedMotion && !entering
    ? ({
      transitionProperty: "left, top",
      transitionDuration: `${PLAYER_EXIT_DURATION_MS}ms`,
      transitionTimingFunction: "ease-in-out",
    } as ViewStyle)
    : undefined;
  const [entryX, entryY] = playerPositionOffset(entryPosition);
  const entryAnimation = {
    from: { transform: [{ translateX: entryX }, { translateY: entryY }] },
    to: { transform: [{ translateX: 0 }, { translateY: 0 }] },
  };

  return (
    <Pressable
      accessibilityLabel={playerLabel}
      accessibilityHint="Use your class support ability"
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID="local-player-actor"
      style={({ pressed }) => [
        styles.actorPosition,
        positionStyle,
        positionTransition,
        { zIndex: 4 },
        pressed && styles.pressedActor,
      ]}
    >
      <View testID="player-sprite-envelope" pointerEvents="none" style={{ width: ACTOR_ENVELOPE, height: ACTOR_ENVELOPE, alignItems: "center", justifyContent: "center", transform: [{ scale: slotScale }] }}>
      <Animated.View
        testID={entering && !reducedMotion ? "player-room-entry-animation" : exitDirection && !entering && !reducedMotion ? "player-room-exit-animation" : undefined}
        style={{
          width: ACTOR_ENVELOPE,
          height: ACTOR_ENVELOPE,
          alignItems: "center",
          justifyContent: "center",
          ...(entering && !reducedMotion ? {
            animationName: entryAnimation,
            animationDuration: `${PLAYER_ENTRY_DURATION_MS}ms`,
            animationTimingFunction: "ease-out",
            animationFillMode: "both",
            animationPlayState: animationsPaused ? "paused" : "running",
          } : {}),
          ...(exitDirection && !entering && !reducedMotion ? {
            animationName: PLAYER_EXIT_MOTION[exitDirection],
            animationDuration: `${PLAYER_EXIT_DURATION_MS}ms`,
            animationTimingFunction: "ease-in",
            animationFillMode: "forwards",
            animationPlayState: animationsPaused ? "paused" : "running",
          } : {}),
        }}
      >
      {auraColor ? <PlayerAura color={auraColor} /> : null}
      <PlayerAnimationLayer
        accessibilityLabel={playerLabel}
        animationFrame={animationFrame}
        energyLossAmount={energyLossAmount}
        healthLossAmount={healthLossAmount}
        reducedMotion={reducedMotion}
        animationsPaused={animationsPaused}
        sceneFrameStore={sceneFrameStore}
        scale={sceneScale}
        sprite={sprite}
      />
      </Animated.View>
      </View>
    </Pressable>
  );
}

const NOOP_SUBSCRIBE = () => () => undefined;
const ENEMY_ANIMATION_KEYS = ["enemyAttackElapsed", "enemyDamageElapsed", "enemyHealthLossElapsed"] as const;
const PLAYER_ANIMATION_KEYS = ["playerAttackElapsed", "playerDamageElapsed", "playerEnergyLossElapsed", "playerHealthLossElapsed"] as const;

function useAnimationFrame(
  sceneFrameStore: SceneFrameStore | undefined,
  fallbackFrame: CombatAnimationFrame | undefined,
  keys: readonly (keyof CombatAnimationFrame)[],
  animationsPaused: boolean,
) {
  const subscribe = useCallback((listener: () => void) => sceneFrameStore
    ? sceneFrameStore.subscribeKeys(keys, listener)
    : NOOP_SUBSCRIBE(), [keys, sceneFrameStore]);
  const lastFrame = useRef(sceneFrameStore?.getSnapshot() ?? fallbackFrame ?? EMPTY_ANIMATION_FRAME);
  const getSnapshot = useCallback(() => {
    if (animationsPaused) return lastFrame.current;
    const frame = sceneFrameStore?.getSnapshot() ?? fallbackFrame ?? EMPTY_ANIMATION_FRAME;
    lastFrame.current = frame;
    return frame;
  }, [animationsPaused, fallbackFrame, sceneFrameStore]);
  const pausedSubscribe = useCallback((listener: () => void) => animationsPaused
    ? NOOP_SUBSCRIBE()
    : subscribe(listener), [animationsPaused, subscribe]);
  return useSyncExternalStore(pausedSubscribe, getSnapshot, getSnapshot);
}

const EMPTY_ANIMATION_FRAME = createCombatAnimationFrame();

function EnemyAnimationLayer({
  accessibilityLabel, amount, animationFrame: fallbackFrame, reducedMotion, animationsPaused, sceneFrameStore, sprite, scale,
}: {
  accessibilityLabel: string; amount: number; animationFrame?: CombatAnimationFrame; reducedMotion: boolean; animationsPaused: boolean;
  sceneFrameStore?: SceneFrameStore; sprite: string; scale: number;
}) {
  const animationFrame = useAnimationFrame(sceneFrameStore, fallbackFrame, ENEMY_ANIMATION_KEYS, animationsPaused);
  const colors = useThemeColors();
  return <View style={{ alignItems: "center", justifyContent: "center", width: 48, height: 48, flexShrink: 0 }}>
    <FloatingResourceLoss amount={amount} color={colors.health} icon="heart" progress={getProgress(animationFrame.enemyHealthLossElapsed, COMBAT_ANIMATION.resourceLossDuration)} testID="enemy-health-loss" />
    <CombatantSprite accessibilityLabel={accessibilityLabel} animationsPaused={animationsPaused} attackDirection="right" attackProgress={getProgress(animationFrame.enemyAttackElapsed, COMBAT_ANIMATION.attackDuration)} damageProgress={getProgress(animationFrame.enemyDamageElapsed, COMBAT_ANIMATION.damageDuration)} reducedMotion={reducedMotion} sprite={sprite} scale={scale} size={getActorSpriteSize(sprite)} />
  </View>;
}

function PlayerAnimationLayer({
  accessibilityLabel, animationFrame: fallbackFrame, energyLossAmount, healthLossAmount, reducedMotion, animationsPaused, sceneFrameStore, scale, sprite,
}: {
  accessibilityLabel: string; animationFrame?: CombatAnimationFrame; energyLossAmount: number; healthLossAmount: number;
  reducedMotion: boolean; animationsPaused: boolean; sceneFrameStore?: SceneFrameStore; scale: number; sprite: string;
}) {
  const animationFrame = useAnimationFrame(sceneFrameStore, fallbackFrame, PLAYER_ANIMATION_KEYS, animationsPaused);
  const colors = useThemeColors();
  return <View style={{ alignItems: "center", justifyContent: "center", width: 48, height: 48, flexShrink: 0 }}>
    <FloatingResourceLoss amount={healthLossAmount} color={colors.health} icon="heart" progress={getProgress(animationFrame.playerHealthLossElapsed, COMBAT_ANIMATION.resourceLossDuration)} testID="player-health-loss" />
    <FloatingResourceLoss amount={energyLossAmount} color={colors.energy} icon="bolt" progress={getProgress(animationFrame.playerEnergyLossElapsed, COMBAT_ANIMATION.resourceLossDuration)} testID="player-energy-loss" />
    <CombatantSprite accessibilityLabel={accessibilityLabel} animationsPaused={animationsPaused} idleAnimationPaused={false} attackDirection="left" attackProgress={getProgress(animationFrame.playerAttackElapsed, COMBAT_ANIMATION.attackDuration)} damageProgress={getProgress(animationFrame.playerDamageElapsed, COMBAT_ANIMATION.damageDuration)} reducedMotion={reducedMotion} sprite={sprite} scale={scale} size={getActorSpriteSize(sprite)} />
  </View>;
}

function playerPositionOffset(position: ScenePosition): [number, number] {
  if (position === "bottom") return [0, 22];
  if (position === "top") return [0, -22];
  if (position === "right") return [22, 0];
  if (position === "left") return [-22, 0];
  return [0, 0];
}

function getDoorwayPlayerInset(position: ScenePosition): [number, number] {
  if (position === "top") return [0, DOORWAY_PLAYER_INSET];
  if (position === "bottom") return [0, -DOORWAY_PLAYER_INSET];
  if (position === "left") return [DOORWAY_PLAYER_INSET, 0];
  if (position === "right") return [-DOORWAY_PLAYER_INSET, 0];
  return [0, 0];
}

export function getProgress(elapsed: number | null, duration: number) {
  if (elapsed === null) {
    return null;
  }

  return Math.max(0, Math.min(1, elapsed / duration));
}



