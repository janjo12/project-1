import { FontAwesome } from "@expo/vector-icons";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";

import { CombatantSprite } from "@/components/combatant-sprite";
import { type ThemeColors, useThemeColors } from "@/components/theme";
import { COMBAT_ANIMATION, type CombatAnimationFrame } from "@/entities";

export type ScenePosition = "top" | "bottom" | "left" | "right" | "center";
type DoorPosition = Exclude<ScenePosition, "center">;
type DoorState = "guarded" | "locked" | "open" | "wall";
export type RoomDoorways = Record<DoorPosition, DoorState>;

export type RoomSceneActor = {
  currentHealth?: number;
  sprite: string;
  kind: "enemy" | "item" | "stairs";
  label: string;
  position?: ScenePosition;
  isActive?: boolean;
  maxHealth?: number;
};

type RoomSceneProps = {
  animationFrame: CombatAnimationFrame;
  bounceOffset: number;
  doorways: RoomDoorways;
  enemyHealthLossAmount: number;
  enemyMaxHitPoints: number;
  actors: RoomSceneActor[];
  playerEnergyLossAmount: number;
  playerHealthLossAmount: number;
  playerPosition: ScenePosition;
  playerSprite: string;
  sceneScale: number;
};

const DOOR_GUARD_ICON = "\u274C";
const DOOR_LOCK_ICON = "\uD83D\uDD12";
const SCENE_SPRITE_HALF_SIZE = 32;

export function RoomScene({
  actors,
  animationFrame,
  bounceOffset,
  doorways,
  enemyHealthLossAmount,
  enemyMaxHitPoints,
  playerEnergyLossAmount,
  playerHealthLossAmount,
  playerPosition,
  playerSprite,
  sceneScale,
}: RoomSceneProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.sceneArea}>
      <RoomWalls doorways={doorways} />

      {actors.map((actor, index) => (
        <SceneActor
          actor={actor}
          animationFrame={animationFrame}
          bounceOffset={bounceOffset}
          enemyHealthLossAmount={enemyHealthLossAmount}
          enemyMaxHitPoints={enemyMaxHitPoints}
          key={`${actor.kind}-${actor.label}-${index}`}
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
      />
    </View>
  );
}

type SceneActorProps = {
  actor: RoomSceneActor;
  animationFrame: CombatAnimationFrame;
  bounceOffset: number;
  enemyHealthLossAmount: number;
  enemyMaxHitPoints: number;
  sceneScale: number;
};

function SceneActor({
  actor,
  animationFrame,
  bounceOffset,
  enemyHealthLossAmount,
  enemyMaxHitPoints,
  sceneScale,
}: SceneActorProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const isActive = actor.isActive ?? true;

  return (
    <View
      style={[
        styles.actorPosition,
        getActorPosition(actor.position ?? "center"),
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
              max={actor.maxHealth ?? enemyMaxHitPoints}
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
};

function PlayerActor({
  animationFrame,
  bounceOffset,
  energyLossAmount,
  healthLossAmount,
  position,
  sceneScale,
  sprite,
}: PlayerActorProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <View style={[styles.actorPosition, getActorPosition(position)]}>
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
  );
}

type EnemyHealthBarProps = {
  accessibilityLabel: string;
  color: string;
  current: number;
  max: number;
  testID: string;
};

function EnemyHealthBar({
  accessibilityLabel,
  color,
  current,
  max,
  testID,
}: EnemyHealthBarProps) {
  const styles = createStyles(useThemeColors());
  const safeMax = Math.max(1, max);
  const fillPercent = Math.max(0, Math.min(100, (current / safeMax) * 100));

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={styles.enemyHealthBarTrack}
      testID={testID}
    >
      <View
        style={[
          styles.enemyHealthBarFill,
          {
            backgroundColor: color,
            width: `${fillPercent}%`,
          },
        ]}
        testID={`${testID}-fill`}
      />
    </View>
  );
}

type FloatingResourceLossProps = {
  amount: number;
  color: string;
  icon: "bolt" | "heart";
  progress: number | null;
  testID: string;
};

function FloatingResourceLoss({
  amount,
  color,
  icon,
  progress,
  testID,
}: FloatingResourceLossProps) {
  const styles = createStyles(useThemeColors());

  if (amount <= 0) {
    return null;
  }

  const visibleProgress = progress ?? 1;
  const opacity =
    progress === null
      ? 0
      : progress < 0.62
        ? 1
        : Math.max(0, 1 - (progress - 0.62) / 0.38);
  const translateY = -28 * visibleProgress;

  return (
    <View
      style={[
        styles.floatingLoss,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
      testID={testID}
    >
      <Text style={[styles.floatingLossText, { color }]}>- {amount}</Text>
      <FontAwesome color={color} name={icon} size={16} testID={`${testID}-icon`} />
    </View>
  );
}

function RoomWalls({ doorways }: { doorways: RoomDoorways }) {
  const styles = createStyles(useThemeColors());
  const positions: DoorPosition[] = ["top", "right", "bottom", "left"];

  return (
    <>
      {positions.map((position) => {
        const state = doorways[position];

        if (state === "wall") {
          return null;
        }

        return (
          <View
            accessibilityLabel={`${position} ${state} doorway`}
            key={position}
            style={[
              styles.doorwayGap,
              position === "top" || position === "bottom"
                ? styles.horizontalDoorwayGap
                : styles.verticalDoorwayGap,
              position === "top" && styles.topDoorwayGap,
              position === "bottom" && styles.bottomDoorwayGap,
              position === "left" && styles.leftDoorwayGap,
              position === "right" && styles.rightDoorwayGap,
            ]}
          >
            {state === "guarded" ? (
              <Text style={[styles.doorwayIcon, styles.guardedDoorwayIcon]}>
                {DOOR_GUARD_ICON}
              </Text>
            ) : null}
            {state === "locked" ? (
              <Text style={[styles.doorwayIcon, styles.lockedDoorwayIcon]}>
                {DOOR_LOCK_ICON}
              </Text>
            ) : null}
          </View>
        );
      })}
    </>
  );
}

function SceneSprite({
  accessibilityLabel,
  sprite,
  scale,
}: {
  accessibilityLabel: string;
  sprite: string;
  scale: number;
}) {
  const styles = createStyles(useThemeColors());

  return (
    <View style={{ transform: [{ scale }] }}>
      <Text accessibilityLabel={accessibilityLabel} style={styles.sprite}>
        {sprite}
      </Text>
    </View>
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

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    actorContent: {
      alignItems: "center",
      justifyContent: "center",
    },
    actorPosition: {
      alignItems: "center",
      justifyContent: "center",
      position: "absolute",
    },
    doorwayGap: {
      alignItems: "center",
      backgroundColor: colors.paper,
      justifyContent: "center",
      position: "absolute",
      zIndex: 3,
    },
    doorwayIcon: {
      fontSize: 17,
      fontWeight: "900",
      lineHeight: 20,
      textAlign: "center",
    },
    bottomDoorwayGap: {
      bottom: -7,
    },
    enemyHealthBarFill: {
      height: "100%",
    },
    enemyHealthBarTrack: {
      backgroundColor: "rgba(239, 68, 68, 0.18)",
      height: 4,
      left: 7,
      overflow: "hidden",
      top: 3,
      width: 56,
    },
    floatingLoss: {
      alignItems: "center",
      flexDirection: "row",
      gap: 4,
      justifyContent: "center",
      position: "absolute",
      top: -4,
      zIndex: 2,
    },
    floatingLossText: {
      fontSize: 18,
      fontWeight: "900",
    },
    guardedDoorwayIcon: {
      color: "#dc2626",
    },
    horizontalDoorwayGap: {
      height: 12,
      left: "42%",
      width: "16%",
    },
    leftDoorwayGap: {
      left: -7,
    },
    lockedDoorwayIcon: {
      color: colors.ink,
    },
    rightDoorwayGap: {
      right: -7,
    },
    sceneArea: {
      borderColor: colors.ink,
      borderWidth: 5,
      height: 220,
      overflow: "visible",
      position: "relative",
      width: "100%",
    },
    sprite: {
      fontSize: 64,
    },
    topDoorwayGap: {
      top: -7,
    },
    verticalDoorwayGap: {
      height: "20%",
      top: "40%",
      width: 12,
    },
  });
}
