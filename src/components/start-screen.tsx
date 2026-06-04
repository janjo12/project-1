import { StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/app-button";
import { ScreenShell } from "@/components/screen-shell";
import { SettingsForm } from "@/components/settings-form";
import { type ThemeColors, useThemeColors } from "@/components/theme";
import type { GameSettings } from "@/utils/settings-storage";

type StartScreenProps = {
  isLoading: boolean;
  settings: GameSettings;
  onSettingsChange: (settings: Partial<GameSettings>) => void;
  onStartGame: () => void;
};

export function StartScreen({
  isLoading,
  settings,
  onSettingsChange,
  onStartGame,
}: StartScreenProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <ScreenShell>
      <View style={styles.container}>
        <Text style={styles.title}>[Title]</Text>

        <SettingsForm settings={settings} onChange={onSettingsChange} />

        <AppButton
          label={isLoading ? "Loading" : "Start"}
          onPress={onStartGame}
        />
      </View>
    </ScreenShell>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    paddingVertical: 52,
  },
  title: {
    color: colors.ink,
    fontSize: 70,
    fontWeight: "500",
    textAlign: "center",
  },
  });
}
