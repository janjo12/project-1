import { StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { SelectableSettingOption } from "@/components/selectable-setting-option";
import { SettingsField } from "@/components/settings-field";
import {
  type ThemeColors,
  useThemeColors,
  useThemeColorScheme,
} from "@/components/theme";
import type {
  Difficulty,
  GameSettings,
  Handedness,
} from "@/utils/settings-storage";

type SettingsFormProps = {
  settings: GameSettings;
  onChange: (settings: Partial<GameSettings>) => void;
};

const difficulties: Difficulty[] = ["easy", "normal", "hard"];
const handednessOptions: Handedness[] = ["left", "right"];

export function SettingsForm({ settings, onChange }: SettingsFormProps) {
  const colors = useThemeColors();
  const colorScheme = useThemeColorScheme();
  const styles = createStyles(colors);
  const isDarkMode =
    settings.appearance === "system"
      ? colorScheme === "dark"
      : settings.appearance === "dark";

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Options</Text>

      <SettingsField label="Difficulty">
        <View style={styles.segmentedControl}>
          {difficulties.map((difficulty) => (
            <SelectableSettingOption
              isSelected={settings.difficulty === difficulty}
              key={difficulty}
              label={difficulty}
              onPress={() => onChange({ difficulty })}
              variant="segment"
            />
          ))}
        </View>
      </SettingsField>

      <SettingsField label="Seed">
        <TextInput
          accessibilityLabel="Seed"
          onChangeText={(seed) => onChange({ seed })}
          placeholder="Random"
          placeholderTextColor={colors.fadedInk}
          style={styles.input}
          value={settings.seed}
        />
      </SettingsField>

      <SettingsField label="Handedness">
        <View style={styles.radioRow}>
          {handednessOptions.map((handedness) => (
            <SelectableSettingOption
              isSelected={settings.handedness === handedness}
              key={handedness}
              label={handedness}
              onPress={() => onChange({ handedness })}
              variant="radio"
            />
          ))}
        </View>
      </SettingsField>

      <View style={styles.toggleGroupRow} testID="preference-toggle-row">
        <View style={styles.compactToggleRow}>
          <Text style={styles.compactToggleLabel}>Dark Mode</Text>
          <Switch
            accessibilityLabel="Dark Mode"
            onValueChange={(isEnabled) =>
              onChange({ appearance: isEnabled ? "dark" : "light" })
            }
            value={isDarkMode}
          />
        </View>
        <View style={styles.compactToggleRow}>
          <Text style={styles.compactToggleLabel}>Vibration</Text>
          <Switch
            accessibilityLabel="Vibration"
            onValueChange={(vibrationEnabled) =>
              onChange({ vibrationEnabled })
            }
            value={settings.vibrationEnabled}
          />
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: {
    gap: 28,
  },
  compactToggleLabel: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "600",
  },
  compactToggleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    minHeight: 34,
  },
  toggleGroupRow: {
    alignItems: "center",
    alignSelf: "center",
    flexDirection: "row",
    gap: 18,
    justifyContent: "center",
  },
  heading: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: "500",
    textAlign: "center",
  },
  segmentedControl: {
    backgroundColor: colors.paperLight,
    borderColor: colors.ink,
    borderRadius: 8,
    borderWidth: 2,
    flexDirection: "row",
    overflow: "hidden",
  },
  input: {
    backgroundColor: colors.paperLight,
    borderColor: colors.ink,
    borderRadius: 3,
    borderWidth: 2,
    color: colors.ink,
    fontSize: 22,
    minHeight: 58,
    paddingHorizontal: 14,
  },
  radioRow: {
    flexDirection: "row",
    gap: 18,
  },
  });
}
