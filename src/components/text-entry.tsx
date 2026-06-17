import { StyleSheet, TextInput } from "react-native";

import { type ThemeColors, useThemeColors } from "@/components/theme";

type TextEntryProps = {
  accessibilityLabel: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
};

export function TextEntry({
  accessibilityLabel,
  onChangeText,
  placeholder,
  value,
}: TextEntryProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <TextInput
      accessibilityLabel={accessibilityLabel}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.fadedInk}
      style={styles.input}
      value={value}
    />
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
  });
}
