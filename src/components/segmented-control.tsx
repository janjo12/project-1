import { StyleSheet, View } from "react-native";

import { SelectableOption } from "@/components/selectable-option";
import { type ThemeColors, useThemeColors } from "@/components/theme";

type SegmentedControlProps<TValue extends string> = {
  onChange: (value: TValue) => void;
  options: readonly TValue[];
  value: TValue;
};

export function SegmentedControl<TValue extends string>({
  onChange,
  options,
  value,
}: SegmentedControlProps<TValue>) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.control}>
      {options.map((option) => (
        <SelectableOption
          isSelected={value === option}
          key={option}
          label={option}
          onPress={() => onChange(option)}
          variant="segment"
        />
      ))}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    control: {
      backgroundColor: colors.paperLight,
      borderColor: colors.ink,
      borderRadius: 8,
      borderWidth: 2,
      flexDirection: "row",
      overflow: "hidden",
    },
  });
}
