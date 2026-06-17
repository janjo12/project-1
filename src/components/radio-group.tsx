import { StyleSheet, View } from "react-native";

import { SelectableOption } from "@/components/selectable-option";

type RadioGroupProps<TValue extends string> = {
  onChange: (value: TValue) => void;
  options: readonly TValue[];
  value: TValue;
};

export function RadioGroup<TValue extends string>({
  onChange,
  options,
  value,
}: RadioGroupProps<TValue>) {
  return (
    <View style={styles.row}>
      {options.map((option) => (
        <SelectableOption
          isSelected={value === option}
          key={option}
          label={option}
          onPress={() => onChange(option)}
          variant="radio"
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 18,
  },
});
