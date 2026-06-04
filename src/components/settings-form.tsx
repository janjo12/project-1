import { StyleSheet, Text, TextInput, View } from "react-native";

import { SelectableSettingOption } from "@/components/selectable-setting-option";
import { SettingsField } from "@/components/settings-field";
import { colors } from "@/components/theme";
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

const styles = StyleSheet.create({
  container: {
    gap: 28,
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
