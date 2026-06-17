import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { PreferenceToggles } from "@/components/preference-toggles";
import { ScreenShell } from "@/components/screen-shell";
import {
  ThemeProvider,
  type ThemeColors,
  useThemeColors,
} from "@/components/theme";
import { useGameSettings } from "@/hooks/use-game-settings";
import type { GameSettings } from "@/utils/settings-storage";

export default function SettingsRoute() {
  const { settings, updateSettings } = useGameSettings();

  return (
    <ThemeProvider appearance={settings.appearance}>
      <SettingsContent
        settings={settings}
        onReturnToTitle={() => router.replace("/")}
        onSettingsChange={updateSettings}
      />
    </ThemeProvider>
  );
}

type SettingsContentProps = {
  settings: GameSettings;
  onReturnToTitle: () => void;
  onSettingsChange: (settings: Partial<GameSettings>) => void;
};

function SettingsContent({
  settings,
  onReturnToTitle,
  onSettingsChange,
}: SettingsContentProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <ScreenShell>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Back to Title"
            accessibilityRole="button"
            onPress={onReturnToTitle}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>Settings</Text>
          <PreferenceToggles
            onChange={onSettingsChange}
            settings={settings}
          />
        </View>
      </View>
    </ScreenShell>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backButton: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: 42,
      paddingHorizontal: 4,
    },
    backButtonText: {
      color: colors.ink,
      fontSize: 18,
      fontWeight: "800",
    },
    container: {
      flex: 1,
      gap: 28,
    },
    content: {
      flex: 1,
      gap: 42,
      justifyContent: "center",
    },
    header: {
      alignItems: "flex-start",
      minHeight: 42,
    },
    pressed: {
      opacity: 0.72,
    },
    title: {
      color: colors.ink,
      fontSize: 48,
      fontWeight: "600",
      textAlign: "center",
    },
  });
}
