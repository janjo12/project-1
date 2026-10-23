import { ACTOR_ENVELOPE, SCENE_HEIGHT, SCENE_WIDTH, layoutRoomActors } from "@/utils/coordinates";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Platform, Pressable, View, type ViewStyle } from "react-native";

import { useThemeColors } from "@/components/Common/theme";
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
const ROOM_FADE_OUT = { from: { opacity: 1 }, to: { opacity: 0 } };
const ROOM_TRANSITION_DURATION_MS = GAME_PARAMETERS.animation.roomTransitionDurationMs;
const PLAYER_EXIT_DURATION_MS = GAME_PARAMETERS.animation.roomExitDurationMs;
const PLAYER_ENTRY_DURATION_MS = GAME_PARAMETERS.animation.roomEntryDurationMs;

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

type RoomTransitionSnapshot = Pick<RoomSceneProps, "roomId" | "actors" | "playerPosition" | "playerSprite" | "playerAuraColor" | "floorLayer" | "doorways">;



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
  const [transitionSnapshot, setTransitionSnapshot] = useState<RoomTransitionSnapshot | null>(null);
  const previousScene = useRef<RoomTransitionSnapshot>({ roomId, actors, playerPosition, playerSprite, playerAuraColor, floorLayer, doorways });
  const nextTransitionKey = useRef(0);
  const stableLayout = useRef<{ roomId?: string; actors: { id: string; position?: ScenePosition }[] } | null>(null);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setSystemReducedMotion(value); }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setSystemReducedMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  useLayoutEffect(() => {
    const previous = previousScene.current;
    if (previous.roomId !== roomId) {
      // Preserve the old room at the doorway while the next room fades in.
      const isAdjacent = getAdjacentRoomTransition(previous.roomId, roomId);
      if (!isAdjacent || reducedMotion || systemReducedMotion || animationsPaused) {
        setTransitionSnapshot(null);
        setTransitionKey(null);
      } else {
        nextTransitionKey.current += 1;
        setTransitionSnapshot(previous);
        setTransitionKey(nextTransitionKey.current);
      }
    }
    previousScene.current = { roomId, actors, playerPosition, playerSprite, playerAuraColor, floorLayer, doorways };
  }, [roomId, actors, playerPosition, playerSprite, playerAuraColor, floorLayer, doorways, reducedMotion, systemReducedMotion, animationsPaused]);
  useEffect(() => {
    if (transitionKey === null || animationsPaused) return;
    const timeout = setTimeout(() => {
      setTransitionKey(null);
      setTransitionSnapshot(null);
    }, ROOM_TRANSITION_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [transitionKey, animationsPaused]);
  const layoutActors = useMemo(() => {
    const previous = stableLayout.current;
    const entries = previous && previous.roomId === roomId ? previous.actors.slice() : [];
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
  }, [actors, playerPosition, roomId]);
  useLayoutEffect(() => {
    stableLayout.current = { roomId, actors: layoutActors };
  }, [layoutActors, roomId]);
  // Keep slots for defeated/collected actors reserved until the room changes. Their removal
  // therefore cannot recenter every other sprite at the end of an attack animation.
  const slots = useMemo(() => layoutRoomActors(layoutActors), [layoutActors]);
  function slotStyle(id: string): ViewStyle {
    const slot = slots[id];
    return { left: slot.x, top: slot.y, width: slot.size, height: slot.size };
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
      {transitionKey !== null ? <Animated.View key={`outgoing-${transitionKey}`} pointerEvents="none" testID="room-transition-snapshot" style={{
        position: "absolute", zIndex: 5, width: SCENE_WIDTH, height: SCENE_HEIGHT,
        pointerEvents: "none",
        animationName: ROOM_FADE_OUT,
        animationDuration: `${ROOM_TRANSITION_DURATION_MS}ms`,
        animationTimingFunction: "ease-out",
        animationFillMode: "forwards",
        animationPlayState: animationsPaused ? "paused" : "running",
        }}><RoomSnapshot actors={transitionSnapshot?.actors ?? actors} playerPosition={transitionSnapshot?.playerPosition ?? playerPosition} playerSprite={transitionSnapshot?.playerSprite ?? playerSprite} playerAuraColor={transitionSnapshot?.playerAuraColor ?? playerAuraColor} floorLayer={transitionSnapshot?.floorLayer ?? floorLayer} doorways={transitionSnapshot?.doorways ?? doorways} /></Animated.View> : null}
      <Animated.View key={transitionKey ?? "current-room"} testID="room-incoming-snapshot" style={{ width: SCENE_WIDTH, height: SCENE_HEIGHT,
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
          slotScale={slots[`${actor.kind}:${actor.id}`].size / ACTOR_ENVELOPE}
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
        slotScale={slots["local-player"].size / ACTOR_ENVELOPE}
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
    </View>
    </View>
  );
}

function RoomSnapshot({ actors, playerPosition, playerSprite, playerAuraColor, floorLayer, doorways }: Pick<RoomSceneProps, "actors" | "playerPosition" | "playerSprite" | "playerAuraColor" | "floorLayer" | "doorways">) {
  const slots = layoutRoomActors([...actors.map(actor => ({ id: `${actor.kind}:${actor.id}`, position: actor.position })), { id: "local-player", position: playerPosition }]);
  return <View style={{ width: SCENE_WIDTH, height: SCENE_HEIGHT }}>
    <View pointerEvents="none" style={{ position: "absolute" }}>{floorLayer ?? <RoomFloor />}</View>
    <RoomWalls canUnlockDoors={false} disabled doorways={doorways} reducedMotion />
    {actors.map(actor => <View key={`${actor.kind}:${actor.id}`} style={{ position: "absolute", left: slots[`${actor.kind}:${actor.id}`].x, top: slots[`${actor.kind}:${actor.id}`].y, width: slots[`${actor.kind}:${actor.id}`].size, height: slots[`${actor.kind}:${actor.id}`].size, alignItems: "center", justifyContent: "center" }}>{actor.kind === "player" && actor.auraColor ? <PlayerAura color={actor.auraColor} /> : null}<SceneSprite accessibilityLabel="" sprite={actor.sprite} scale={1} size={48} /></View>)}
    <View style={{ position: "absolute", left: slots["local-player"].x, top: slots["local-player"].y, width: slots["local-player"].size, height: slots["local-player"].size, alignItems: "center", justifyContent: "center" }}>{playerAuraColor ? <PlayerAura color={playerAuraColor} /> : null}<SceneSprite accessibilityLabel="" sprite={playerSprite} scale={1} /></View>
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
  const actorRef = useRef<View>(null);
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
        // Dispatch the interaction immediately; React Native Web doesn't consistently
        // invoke measureInWindow on Pressable refs, so measurement cannot gate pickup.
        const { pageX, pageY } = event.nativeEvent;
        onPress?.(actor, Number.isFinite(pageX) && Number.isFinite(pageY)
          ? { x: pageX, y: pageY }
          : undefined);
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
            /> : <CombatantSprite accessibilityLabel={actor.label} animationsPaused={animationsPaused} reducedMotion={reducedMotion} sprite={actor.sprite} scale={sceneScale} size={48} />}
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
          <SceneSprite accessibilityLabel={actor.label} sprite={actor.sprite} scale={sceneScale} size={48} />
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
  const positionTransition = Platform.OS === "web" && !reducedMotion
    ? ({
      transitionProperty: "left, top",
      transitionDuration: `${PLAYER_EXIT_DURATION_MS}ms`,
      transitionTimingFunction: "ease-in-out",
    } as ViewStyle)
    : undefined;
  const [entryX, entryY] = playerPositionOffset(entryPosition);
  const entryAnimation = {
    from: { opacity: 0, transform: [{ translateX: entryX }, { translateY: entryY }] },
    to: { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }] },
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
        pressed && styles.pressedActor,
      ]}
    >
      <View pointerEvents="none" style={{ width: ACTOR_ENVELOPE, height: ACTOR_ENVELOPE, alignItems: "center", justifyContent: "center", transform: [{ scale: slotScale }] }}>
      <Animated.View
        key={entering ? `player-room-entry-${entryPosition}` : "player-room-static"}
        testID={entering && !reducedMotion ? "player-room-entry-animation" : undefined}
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
    <CombatantSprite accessibilityLabel={accessibilityLabel} animationsPaused={animationsPaused} attackDirection="right" attackProgress={getProgress(animationFrame.enemyAttackElapsed, COMBAT_ANIMATION.attackDuration)} damageProgress={getProgress(animationFrame.enemyDamageElapsed, COMBAT_ANIMATION.damageDuration)} reducedMotion={reducedMotion} sprite={sprite} scale={scale} size={48} />
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
    <CombatantSprite accessibilityLabel={accessibilityLabel} animationsPaused={animationsPaused} attackDirection="left" attackProgress={getProgress(animationFrame.playerAttackElapsed, COMBAT_ANIMATION.attackDuration)} damageProgress={getProgress(animationFrame.playerDamageElapsed, COMBAT_ANIMATION.damageDuration)} reducedMotion={reducedMotion} sprite={sprite} scale={scale} size={48} />
  </View>;
}

function playerPositionOffset(position: ScenePosition): [number, number] {
  if (position === "bottom") return [0, 22];
  if (position === "top") return [0, -22];
  if (position === "right") return [22, 0];
  if (position === "left") return [-22, 0];
  return [0, 0];
}

export function getProgress(elapsed: number | null, duration: number) {
  if (elapsed === null) {
    return null;
  }

  return Math.max(0, Math.min(1, elapsed / duration));
}



