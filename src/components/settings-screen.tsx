import { Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { ScreenShell } from "@/components/screen-shell";
import { type ThemeColors, useThemeColors, useThemeColorScheme } from "@/components/theme";
import type { GameSettings } from "@/utils/settings-storage";

type SettingsScreenProps = {
  settings: GameSettings;
  onReturnToTitle: () => void;
  onSettingsChange: (settings: Partial<GameSettings>) => void;
};

export function SettingsScreen({
  settings,
  onReturnToTitle,
  onSettingsChange,
}: SettingsScreenProps) {
  const colors = useThemeColors();
  const colorScheme = useThemeColorScheme();
  const styles = createStyles(colors);
  const isDarkMode =
    settings.appearance === "system"
      ? colorScheme === "dark"
      : settings.appearance === "dark";

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

          <View style={styles.settingRows}>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Dark Mode</Text>
              <Switch
                accessibilityLabel="Dark Mode"
                onValueChange={(isEnabled) =>
                  onSettingsChange({ appearance: isEnabled ? "dark" : "light" })
                }
                value={isDarkMode}
              />
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Vibration</Text>
              <Switch
                accessibilityLabel="Vibration"
                onValueChange={(vibrationEnabled) =>
                  onSettingsChange({ vibrationEnabled })
                }
                value={settings.vibrationEnabled}
              />
            </View>
          </View>
        </View>
      </View>
    </ScreenShell>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backButton: {
      alignItems: "center",
      minHeight: 42,
      justifyContent: "center",
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
    settingLabel: {
      color: colors.ink,
      fontSize: 26,
      fontWeight: "700",
    },
    settingRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      minHeight: 58,
    },
    settingRows: {
      gap: 24,
    },
    title: {
      color: colors.ink,
      fontSize: 48,
      fontWeight: "600",
      textAlign: "center",
    },
  });
}
