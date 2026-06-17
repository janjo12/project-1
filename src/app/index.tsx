import { FontAwesome } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/app-button";
import { GameOptionsForm } from "@/components/game-options-form";
import { ScreenShell } from "@/components/screen-shell";
import { ThemeProvider, useThemeColors } from "@/components/theme";
import { useGameSettings } from "@/hooks/use-game-settings";
import { generateRandomSeed } from "@/utils/seed";

export default function Index() {
  const { isLoading, settings, updateSettings, saveSettings } =
    useGameSettings({ refreshSeedOnLoad: true });

  const handleStartGame = async () => {
    const nextSettings = {
      ...settings,
      seed: settings.seed.trim() || generateRandomSeed(),
    };

    await saveSettings(nextSettings);
    router.replace("/game");
  };

  const handleOpenSettings = () => {
    router.push("/settings");
  };

  return (
    <ThemeProvider appearance={settings.appearance}>
      <ScreenShell>
        <View style={styles.container}>
          <View style={styles.header}>
            <SettingsButton onPress={handleOpenSettings} />
          </View>
          <TitleText />
          <GameOptionsForm settings={settings} onChange={updateSettings} />
          <View style={styles.footer}>
            <AppButton
              label={isLoading ? "Loading" : "Start"}
              onPress={handleStartGame}
            />
          </View>
        </View>
      </ScreenShell>
    </ThemeProvider>
  );
}

function SettingsButton({ onPress }: { onPress: () => void }) {
  const colors = useThemeColors();

  return (
    <Pressable
      accessibilityLabel="Settings"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingsButton,
        pressed && styles.pressed,
      ]}
      testID="open-settings-button"
    >
      <FontAwesome color={colors.ink} name="cog" size={28} />
    </Pressable>
  );
}

function TitleText() {
  const colors = useThemeColors();

  return <Text style={[styles.title, { color: colors.ink }]}>[Title]</Text>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 22,
    justifyContent: "flex-start",
    paddingBottom: 20,
    paddingTop: 16,
  },
  footer: {
    paddingTop: 8,
  },
  header: {
    alignItems: "flex-start",
    minHeight: 36,
  },
  pressed: {
    opacity: 0.72,
  },
  settingsButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 36,
    width: 36,
  },
  title: {
    fontSize: 62,
    fontWeight: "500",
    textAlign: "center",
  },
});
