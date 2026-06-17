import { StyleSheet, Switch, Text, View } from "react-native";

import {
  type ThemeColors,
  useThemeColors,
  useThemeColorScheme,
} from "@/components/theme";
import type { GameSettings } from "@/utils/settings-storage";

type PreferenceTogglesProps = {
  onChange: (settings: Partial<GameSettings>) => void;
  settings: Pick<GameSettings, "appearance" | "vibrationEnabled">;
};

export function PreferenceToggles({
  onChange,
  settings,
}: PreferenceTogglesProps) {
  const colors = useThemeColors();
  const colorScheme = useThemeColorScheme();
  const styles = createStyles(colors);
  const isDarkMode =
    settings.appearance === "system"
      ? colorScheme === "dark"
      : settings.appearance === "dark";

  return (
    <View style={styles.section}>
      <PreferenceRow
        label="Dark Mode"
        onValueChange={(isEnabled) =>
          onChange({ appearance: isEnabled ? "dark" : "light" })
        }
        value={isDarkMode}
      />
      <PreferenceRow
        label="Vibration"
        onValueChange={(vibrationEnabled) => onChange({ vibrationEnabled })}
        value={settings.vibrationEnabled}
      />
    </View>
  );
}

type PreferenceRowProps = {
  label: string;
  onValueChange: (value: boolean) => void;
  value: boolean;
};

function PreferenceRow({ label, onValueChange, value }: PreferenceRowProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        onValueChange={onValueChange}
        value={value}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    label: {
      color: colors.ink,
      fontSize: 26,
      fontWeight: "700",
    },
    row: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      minHeight: 58,
    },
    section: {
      gap: 24,
    },
  });
}
