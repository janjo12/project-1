import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/app-button";
import { ScreenShell } from "@/components/screen-shell";
import { SettingsForm } from "@/components/settings-form";
import { type ThemeColors, useThemeColors } from "@/components/theme";
import type { GameSettings } from "@/utils/settings-storage";

type StartScreenProps = {
  isLoading: boolean;
  settings: GameSettings;
  onOpenSettings: () => void;
  onSettingsChange: (settings: Partial<GameSettings>) => void;
  onStartGame: () => void;
};

export function StartScreen({
  isLoading,
  settings,
  onOpenSettings,
  onSettingsChange,
  onStartGame,
}: StartScreenProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <ScreenShell>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Settings"
            accessibilityRole="button"
            onPress={onOpenSettings}
            style={({ pressed }) => [
              styles.settingsButton,
              pressed && styles.pressed,
            ]}
            testID="open-settings-button"
          >
            <Ionicons color={colors.ink} name="settings-sharp" size={28} />
          </Pressable>
        </View>

        <Text style={styles.title}>[Title]</Text>

        <SettingsForm settings={settings} onChange={onSettingsChange} />

        <View style={styles.startButtonSlot}>
          <AppButton
            label={isLoading ? "Loading" : "Start"}
            onPress={onStartGame}
          />
        </View>
      </View>
    </ScreenShell>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: {
    flex: 1,
    gap: 22,
    justifyContent: "flex-start",
    paddingBottom: 20,
    paddingTop: 16,
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
  startButtonSlot: {
    paddingTop: 8,
  },
  title: {
    color: colors.ink,
    fontSize: 62,
    fontWeight: "500",
    textAlign: "center",
  },
  });
}
