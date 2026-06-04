import { FontAwesome } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { CombatantSprite } from "@/components/combatant-sprite";
import { type ThemeColors, useThemeColors } from "@/components/theme";

export type Enemy = {
  emoji: string;
  hitPoints: number;
  name: string;
};

type GameViewPanelProps = {
  enemy?: Enemy;
  enemyRoster?: Enemy[];
  enemyAttackSignal?: number;
  monsterDamageSignal?: number;
  playerAttackSignal?: number;
  playerDamageSignal?: number;
  playerEnergy?: number;
  playerHealth?: number;
};

const defaultEnemy: Enemy = {
  emoji: "👾",
  hitPoints: 3,
  name: "Glitch Imp",
};

function iconSlots(count: number) {
  return Array.from({ length: Math.max(0, count) }, (_, index) => index);
}

export function GameViewPanel({
  enemy = defaultEnemy,
  enemyRoster = [defaultEnemy],
  enemyAttackSignal = 0,
  monsterDamageSignal = 0,
  playerAttackSignal = 0,
  playerDamageSignal = 0,
  playerEnergy = 6,
  playerHealth = 10,
}: GameViewPanelProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.panel}>
      <View style={styles.statusRow}>
        <View accessibilityLabel="Player health" style={styles.statusIcons}>
          {iconSlots(playerHealth).map((iconIndex) => (
            <FontAwesome
              color={colors.health}
              key={`player-health-${iconIndex}`}
              name="heart"
              size={14}
              testID="player-health-icon"
            />
          ))}
        </View>
        <View accessibilityLabel="Player energy" style={styles.statusIcons}>
          {iconSlots(playerEnergy).map((iconIndex) => (
            <FontAwesome
              color={colors.energy}
              key={`player-energy-${iconIndex}`}
              name="bolt"
              size={16}
              testID="player-energy-icon"
            />
          ))}
        </View>
      </View>

      <View accessibilityLabel="Enemy roster" style={styles.enemyRoster}>
        {enemyRoster.map((rosterEnemy) => (
          <Text
            accessibilityLabel={`${rosterEnemy.name} roster enemy`}
            key={rosterEnemy.name}
            style={[
              styles.rosterEmoji,
              rosterEnemy.name === enemy.name && styles.currentRosterEmoji,
            ]}
          >
            {rosterEnemy.emoji}
          </Text>
        ))}
      </View>

      <View style={styles.sceneBox}>
        <CombatantSprite
          accessibilityLabel={enemy.name}
          attackDirection="right"
          attackSignal={enemyAttackSignal}
          damageSignal={monsterDamageSignal}
          emoji={enemy.emoji}
        />
        <View accessibilityLabel="Enemy health" style={styles.enemyHealth}>
          {iconSlots(enemy.hitPoints).map((iconIndex) => (
            <FontAwesome
              color={colors.health}
              key={`enemy-health-${iconIndex}`}
              name="heart"
              size={13}
              testID="enemy-health-icon"
            />
          ))}
        </View>
        <CombatantSprite
          accessibilityLabel="Player warrior"
          attackDirection="left"
          attackSignal={playerAttackSignal}
          damageSignal={playerDamageSignal}
          emoji="🤺"
        />
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    panel: {
      backgroundColor: colors.paper,
      borderColor: colors.ink,
      borderRadius: 3,
      borderWidth: 2,
      gap: 6,
      padding: 8,
    },
    statusRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    statusIcons: {
      alignItems: "center",
      flexDirection: "row",
      gap: 4,
      minHeight: 18,
    },
    enemyRoster: {
      flexDirection: "row",
      gap: 8,
      justifyContent: "center",
    },
    rosterEmoji: {
      fontSize: 18,
      lineHeight: 24,
      opacity: 0.55,
    },
    currentRosterEmoji: {
      opacity: 1,
    },
    sceneBox: {
      alignItems: "center",
      backgroundColor: colors.paperLight,
      borderColor: colors.ink,
      borderRadius: 3,
      borderWidth: 3,
      gap: 10,
      justifyContent: "center",
      minHeight: 230,
      padding: 20,
    },
    enemyHealth: {
      alignItems: "center",
      flexDirection: "row",
      gap: 4,
      minHeight: 20,
    },
  });
}
