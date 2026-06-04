import { StyleSheet, Text, View } from "react-native";

import { CombatantSprite } from "@/components/combatant-sprite";
import { colors } from "@/components/theme";

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

function iconsFor(count: number, icon: string) {
  return Array.from({ length: Math.max(0, count) }, () => icon).join(" ");
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
  return (
    <View style={styles.panel}>
      <View style={styles.statusRow}>
        <Text accessibilityLabel="Player health" style={styles.statusText}>
          {iconsFor(playerHealth, "❤️")}
        </Text>
        <Text accessibilityLabel="Player energy" style={styles.statusText}>
          {iconsFor(playerEnergy, "⚡")}
        </Text>
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
        <Text accessibilityLabel="Enemy health" style={styles.enemyHealth}>
          {iconsFor(enemy.hitPoints, "❤️")}
        </Text>
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

const styles = StyleSheet.create({
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
  statusText: {
    color: colors.fadedInk,
    fontSize: 14,
    fontWeight: "700",
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
    color: colors.fadedInk,
    fontSize: 13,
    fontWeight: "700",
    minHeight: 20,
  },
});
