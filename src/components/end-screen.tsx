import { StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/app-button";
import { ScreenShell } from "@/components/screen-shell";
import { type ThemeColors, useThemeColors } from "@/components/theme";

type EndScreenProps = {
  score: string;
  onReturnToTitle: () => void;
};

export function EndScreen({ score, onReturnToTitle }: EndScreenProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <ScreenShell>
      <View style={styles.container}>
        <View style={styles.titleGroup}>
          <Text style={styles.gameOver}>Game</Text>
          <Text style={styles.gameOver}>Over</Text>
        </View>

        <Text style={styles.score}>Score: {score}</Text>

        <AppButton label="Return to Title" onPress={onReturnToTitle} />
      </View>
    </ScreenShell>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    paddingVertical: 56,
  },
  titleGroup: {
    alignItems: "center",
    gap: 18,
  },
  gameOver: {
    color: colors.ink,
    fontSize: 82,
    fontWeight: "500",
    lineHeight: 92,
    textAlign: "center",
  },
  score: {
    color: colors.fadedInk,
    fontSize: 38,
    fontWeight: "500",
    textAlign: "center",
  },
  });
}
