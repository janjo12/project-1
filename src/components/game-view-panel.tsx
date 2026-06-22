import { FontAwesome } from "@expo/vector-icons";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";

import { CombatantSprite } from "@/components/combatant-sprite";
import { useThemeColors, type ThemeColors } from "@/components/theme";
import {
  COMBAT_ANIMATION,
  createCombatAnimationFrame,
  type CombatAnimationFrame,
} from "@/entities";

export type Enemy = {
  sprite: string;
  hitPoints: number;
  name: string;
};

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

type GameViewPanelProps = {
  animationFrame?: CombatAnimationFrame;
  enemy?: Enemy | null;
  enemyHealthLossAmount?: number;
  enemyMaxHitPoints?: number;
  floorItem?: string | null;
  floorStairs?: boolean;
  playerPosition?: ScenePosition;
  roomDoorways?: RoomDoorways;
  roomSceneActors?: RoomSceneActor[];
  playerEnergyLossAmount?: number;
  playerHealthLossAmount?: number;
};

const PLAYER_SPRITE = "\uD83E\uDD3A";
const STAIRS_SPRITE = "\uD83E\uDE9C";
const DOOR_GUARD_ICON = "\u274C";
const DOOR_LOCK_ICON = "\uD83D\uDD12";
const SCENE_SPRITE_HALF_SIZE = 32;
const defaultRoomDoorways: RoomDoorways = {
  bottom: "wall",
  left: "wall",
  right: "wall",
  top: "wall",
};

export function GameViewPanel({
  animationFrame = createCombatAnimationFrame(),
  enemy = null,
  enemyHealthLossAmount = 0,
  enemyMaxHitPoints = enemy?.hitPoints ?? 1,
  floorItem = null,
  floorStairs = false,
  playerPosition = "center",
  roomDoorways = defaultRoomDoorways,
  roomSceneActors,
  playerEnergyLossAmount = 0,
  playerHealthLossAmount = 0,
}: GameViewPanelProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const bounceOffset = getBounceOffset(animationFrame.bounceElapsed);
  const visibleActors = roomSceneActors ?? createSceneActors({
    enemy,
    enemyMaxHitPoints,
    floorItem,
    floorStairs,
  });
  const sceneScale = getSceneScale(visibleActors.length + 1);

  return (
    <View style={styles.panel}>
      <View style={styles.sceneBox}>
        <View style={styles.sceneArea}>
          <RoomWalls doorways={roomDoorways} />

          {visibleActors.map((actor, index) => (
            <View
              key={`${actor.kind}-${actor.label}-${index}`}
              style={[
                styles.sceneActorPosition,
                getActorPosition(actor.position ?? "center"),
              ]}
            >
              {actor.kind === "enemy" ? (
                <View style={styles.sceneActorContent}>
                  {actor.isActive ?? true ? (
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
                  <View
                    style={{
                      transform: [{ translateY: bounceOffset }],
                    }}
                  >
                    <CombatantSprite
                      accessibilityLabel={actor.label}
                      attackDirection="right"
                      attackProgress={
                        actor.isActive ?? true
                          ? getProgress(
                              animationFrame.enemyAttackElapsed,
                              COMBAT_ANIMATION.attackDuration,
                            )
                          : null
                      }
                      damageProgress={
                        actor.isActive ?? true
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
                      current={actor.currentHealth ?? enemy?.hitPoints ?? 1}
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
          ))}

          <View
            style={[
              styles.sceneActorPosition,
              getActorPosition(playerPosition),
            ]}
          >
            <FloatingResourceLoss
              amount={playerHealthLossAmount}
              color={colors.health}
              icon="heart"
              progress={getProgress(
                animationFrame.playerHealthLossElapsed,
                COMBAT_ANIMATION.resourceLossDuration,
              )}
              testID="player-health-loss"
            />
            <FloatingResourceLoss
              amount={playerEnergyLossAmount}
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
              sprite={PLAYER_SPRITE}
              scale={sceneScale}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

function createSceneActors({
  enemy,
  enemyMaxHitPoints,
  floorItem,
  floorStairs,
}: Pick<GameViewPanelProps, "enemy" | "enemyMaxHitPoints" | "floorItem" | "floorStairs">) {
  const actors: RoomSceneActor[] = [];

  if (enemy) {
    actors.push({
      currentHealth: enemy.hitPoints,
      sprite: enemy.sprite,
      kind: "enemy",
      label: enemy.name,
      maxHealth: enemyMaxHitPoints ?? enemy.hitPoints,
    });
  }

  if (floorStairs) {
    actors.push({
      sprite: STAIRS_SPRITE,
      kind: "stairs",
      label: "Stairs",
      position: "center",
    });
  }

  if (floorItem && !enemy) {
    actors.push({
      sprite: floorItem,
      kind: "item",
      label: "Floor item",
      position: "center",
    });
  }

  return actors;
}

function getSceneScale(actorCount: number) {
  if (actorCount <= 2) {
    return 1;
  }

  if (actorCount === 3) {
    return 0.92;
  }

  if (actorCount === 4) {
    return 0.84;
  }

  if (actorCount === 5) {
    return 0.78;
  }

  return 0.72;
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

type ResourceBarProps = {
  accessibilityLabel: string;
  color: string;
  current: number;
  icon: keyof typeof FontAwesome.glyphMap;
  max: number;
  panelPosition?: "first" | "last" | "middle" | "single";
  testID: string;
};

export function ResourceBar({
  accessibilityLabel,
  color,
  current,
  icon,
  max,
  panelPosition = "single",
  testID,
}: ResourceBarProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const safeMax = Math.max(1, max);
  const fillPercent = Math.max(0, Math.min(100, (current / safeMax) * 100));

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.resourceBarRow,
        panelPosition !== "single" && styles.connectedResourceBarRow,
        panelPosition !== "first" &&
          panelPosition !== "single" &&
          styles.overlappedResourceBarRow,
        (panelPosition === "first" || panelPosition === "single") &&
          styles.firstResourceBarRow,
        (panelPosition === "last" || panelPosition === "single") &&
          styles.lastResourceBarRow,
      ]}
      testID={testID}
    >
      <FontAwesome
        color={color}
        name={icon}
        size={13}
        testID={`${testID}-icon`}
      />
      <View style={styles.resourceBarTrack}>
        <View
          style={[
            styles.resourceBarFill,
            {
              backgroundColor: color,
              width: `${fillPercent}%`,
            },
          ]}
          testID={`${testID}-fill`}
        />
      </View>
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

function getProgress(elapsed: number | null, duration: number) {
  if (elapsed === null) {
    return null;
  }

  return Math.max(0, Math.min(1, elapsed / duration));
}

function getBounceOffset(elapsed: number) {
  const progress =
    (elapsed % COMBAT_ANIMATION.bounceDuration) /
    COMBAT_ANIMATION.bounceDuration;

  return Math.sin(progress * Math.PI * 2) * COMBAT_ANIMATION.bounceDistance;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    panel: {
      backgroundColor: "transparent",
      gap: 6,
    },
    sceneBox: {
      alignItems: "center",
      backgroundColor: "transparent",
      gap: 8,
      justifyContent: "center",
      minHeight: 224,
      padding: 14,
    },
    sceneArea: {
      borderColor: "#ffffff",
      borderWidth: 5,
      overflow: "visible",
      width: "100%",
      height: 220,
      position: "relative",
    },
    sceneActorPosition: {
      position: "absolute",
      alignItems: "center",
      justifyContent: "center",
    },
    sceneActorContent: {
      alignItems: "center",
      justifyContent: "center",
    },
    enemyHealthBarTrack: {
      backgroundColor: "rgba(239, 68, 68, 0.18)",
      height: 4,
      overflow: "hidden",
      width: 56,
      top: 3,
      left: 7,
    },
    enemyHealthBarFill: {
      height: "100%",
    },
    resourceBarRow: {
      alignItems: "center",
      backgroundColor: colors.paper,
      borderColor: colors.resourceBorder,
      borderRadius: 8,
      borderWidth: 2,
      flexDirection: "row",
      gap: 6,
      minHeight: 24,
      paddingHorizontal: 7,
      paddingVertical: 5,
      width: "100%",
    },
    connectedResourceBarRow: {
      borderRadius: 0,
    },
    overlappedResourceBarRow: {
      marginTop: -2,
    },
    firstResourceBarRow: {
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
    },
    lastResourceBarRow: {
      borderBottomLeftRadius: 8,
      borderBottomRightRadius: 8,
    },
    resourceBarTrack: {
      backgroundColor: colors.paperLight,
      borderRadius: 999,
      flex: 1,
      height: 10,
      overflow: "hidden",
    },
    resourceBarFill: {
      borderRadius: 999,
      height: "100%",
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
    sprite: {
      fontSize: 64,
    },
    doorwayGap: {
      alignItems: "center",
      backgroundColor: colors.paper,
      justifyContent: "center",
      position: "absolute",
      zIndex: 3,
    },
    horizontalDoorwayGap: {
      height: 12,
      left: "42%",
      width: "16%",
    },
    verticalDoorwayGap: {
      height: "20%",
      top: "40%",
      width: 12,
    },
    topDoorwayGap: {
      top: -7,
    },
    bottomDoorwayGap: {
      bottom: -7,
    },
    leftDoorwayGap: {
      left: -7,
    },
    rightDoorwayGap: {
      right: -7,
    },
    doorwayIcon: {
      fontSize: 17,
      fontWeight: "900",
      lineHeight: 20,
      textAlign: "center",
    },
    guardedDoorwayIcon: {
      color: "#dc2626",
    },
    lockedDoorwayIcon: {
      color: "#ffffff",
    },
  });
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
