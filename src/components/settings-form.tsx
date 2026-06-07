import { StyleSheet, TextInput, View } from "react-native";

import { SelectableSettingOption } from "@/components/selectable-setting-option";
import { SettingsField } from "@/components/settings-field";
import { type ThemeColors, useThemeColors } from "@/components/theme";
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
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
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
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: {
    gap: 20,
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
    fontSize: 20,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  radioRow: {
    flexDirection: "row",
    gap: 18,
  },
  });
}
