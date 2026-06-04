import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/components/theme";

type SelectableSettingOptionProps = {
  isSelected: boolean;
  label: string;
  onPress: () => void;
  variant: "segment" | "radio";
};

export function SelectableSettingOption({
  isSelected,
  label,
  onPress,
  variant,
}: SelectableSettingOptionProps) {
  const isRadio = variant === "radio";

  return (
    <Pressable
      accessibilityRole={isRadio ? "radio" : "button"}
      accessibilityState={
        isRadio ? { checked: isSelected } : { selected: isSelected }
      }
      onPress={onPress}
      style={[
        isRadio ? styles.radioOption : styles.segment,
        !isRadio && isSelected && styles.selectedSegment,
      ]}
    >
      {isRadio && (
        <View
          style={[styles.radioMark, isSelected && styles.selectedRadioMark]}
        />
      )}
      <Text
        style={[
          isRadio ? styles.radioText : styles.segmentText,
          !isRadio && isSelected && styles.selectedText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  segment: {
    alignItems: "center",
    flex: 1,
    paddingVertical: 12,
  },
  selectedSegment: {
    backgroundColor: colors.ink,
  },
  segmentText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  selectedText: {
    color: colors.paperLight,
  },
  radioOption: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  radioMark: {
    backgroundColor: colors.paperLight,
    borderColor: colors.ink,
    borderRadius: 999,
    borderWidth: 3,
    height: 26,
    width: 26,
  },
  selectedRadioMark: {
    backgroundColor: colors.ink,
  },
  radioText: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "600",
    textTransform: "capitalize",
  },
});
