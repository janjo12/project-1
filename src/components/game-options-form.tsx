import { StyleSheet, View } from "react-native";

import { FormField } from "@/components/form-field";
import { RadioGroup } from "@/components/radio-group";
import { SegmentedControl } from "@/components/segmented-control";
import { TextEntry } from "@/components/text-entry";
import type {
  Difficulty,
  GameSettings,
  Handedness,
} from "@/utils/settings-storage";

type GameOptionsFormProps = {
  settings: GameSettings;
  onChange: (settings: Partial<GameSettings>) => void;
};

const difficulties: Difficulty[] = ["easy", "normal", "hard"];
const handednessOptions: Handedness[] = ["left", "right"];

export function GameOptionsForm({ settings, onChange }: GameOptionsFormProps) {
  return (
    <View style={styles.container}>
      <FormField label="Difficulty">
        <SegmentedControl
          onChange={(difficulty) => onChange({ difficulty })}
          options={difficulties}
          value={settings.difficulty}
        />
      </FormField>

      <FormField label="Seed">
        <TextEntry
          accessibilityLabel="Seed"
          onChangeText={(seed) => onChange({ seed })}
          placeholder="Random"
          value={settings.seed}
        />
      </FormField>

      <FormField label="Handedness">
        <RadioGroup
          onChange={(handedness) => onChange({ handedness })}
          options={handednessOptions}
          value={settings.handedness}
        />
      </FormField>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 20,
  },
});
